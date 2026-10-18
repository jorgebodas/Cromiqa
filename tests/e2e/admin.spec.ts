import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fakeSupabase } from './fakeSupabase';

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString();
const WAITLIST = [
  { id: 'w1', email: 'ana@example.com', zone: 'Rivas-Vaciamadrid', source: 'landing', created_at: day(0) },
  { id: 'w2', email: 'luis@example.com', zone: 'Coslada', source: 'landing', created_at: day(2) },
  { id: 'w3', email: 'marta@example.com', zone: null, source: 'landing', created_at: day(20) },
];
const MECHANICS = [
  { id: 'm1', name: 'Rosa Gil', workshop: 'Taller Rosa', email: 'rosa@example.com', phone: '600000000', zone: 'Arganda del Rey', specialty: 'MTB', status: 'new', notes: '', created_at: day(1), updated_at: day(1) },
  { id: 'm2', name: 'Pedro Sanz', workshop: null, email: 'pedro@example.com', phone: null, zone: 'Coslada', specialty: null, status: 'onboarded', notes: 'Firmado', created_at: day(5), updated_at: day(3) },
];

async function login(page: import('@playwright/test').Page, password = 'correcta') {
  await page.goto('./#/admin');
  await page.getByLabel('Email').fill('admin@cromiqa.com');
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('rejects wrong credentials and non-admin accounts', async ({ page }) => {
  await fakeSupabase(page, { admin: false });
  await login(page, 'mala');
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  await page.getByLabel('Contraseña').fill('correcta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible();
});

test('overview shows metrics from the database', async ({ page }) => {
  await fakeSupabase(page, { waitlist: WAITLIST, mechanics: MECHANICS });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  const tile = (label: string) => page.locator('div', { has: page.getByText(label, { exact: true }) }).last();
  await expect(tile('Lista de espera')).toContainText('3');
  await expect(tile('Lista de espera')).toContainText('+2 en 7 días');
  await expect(tile('Mecánicos interesados')).toContainText('2');
  await expect(page.getByText('Lista de espera por zona')).toBeVisible();
  await page.getByRole('button', { name: 'Ver tabla' }).first().click();
  await expect(page.getByRole('columnheader', { name: 'Registros' })).toBeVisible();
});

test('waitlist: search, export CSV and delete', async ({ page }) => {
  const { log } = await fakeSupabase(page, { waitlist: WAITLIST, mechanics: MECHANICS });
  await login(page);
  await page.getByRole('link', { name: 'Lista de espera' }).click();
  const table = page.getByTestId('waitlist-table');
  await expect(table.getByRole('row')).toHaveCount(4);
  await page.getByLabel('Buscar').fill('cosl');
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByLabel('Buscar').fill('');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const file = await (await download).path();
  const csv = readFileSync(file, 'utf8');
  expect(csv).toContain('Email,Zona,Origen,Fecha de registro');
  expect(csv).toContain('ana@example.com');

  await page.getByRole('button', { name: 'Eliminar luis@example.com' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(table.getByRole('row')).toHaveCount(3);
  expect(log.some((l) => l.method === 'DELETE' && l.path.includes('waitlist_leads') && l.path.includes('id=eq.w2'))).toBe(true);
});

test('mechanics: change status and save notes', async ({ page }) => {
  const { db } = await fakeSupabase(page, { mechanics: MECHANICS });
  await login(page);
  await page.getByRole('link', { name: 'Mecánicos' }).click();
  await expect(page.getByTestId('mechanic-row')).toHaveCount(2);
  await page.getByLabel('Estado de Rosa Gil').selectOption('contacted');
  await expect(page.getByText('Estado: Contactado')).toBeVisible();
  expect(db.mechanic_leads!.find((m) => m.id === 'm1')!.status).toBe('contacted');

  await page.getByRole('button', { name: /Rosa Gil/ }).click();
  await page.getByLabel('Notas internas').fill('Llamar el lunes');
  await page.getByRole('button', { name: 'Guardar notas' }).click();
  await expect(page.getByText('Notas guardadas')).toBeVisible();
  expect(db.mechanic_leads!.find((m) => m.id === 'm1')!.notes).toBe('Llamar el lunes');

  await page.getByLabel('Filtrar por estado').selectOption('onboarded');
  await expect(page.getByTestId('mechanic-row')).toHaveCount(1);
});

test('content: publish carousel texts that the public site then shows', async ({ page }) => {
  const { db } = await fakeSupabase(page);
  await login(page);
  await page.getByRole('link', { name: 'Contenido' }).click();
  await expect(page.getByTestId('benefit-row')).toHaveCount(6);
  await page.getByLabel('Título 1').fill('Reparación exprés');
  await page.getByLabel('Texto 1').fill('Arreglamos tu bici en el día.');
  await page.getByRole('button', { name: 'Publicar textos' }).click();
  await expect(page.getByText('Textos publicados en la web')).toBeVisible();
  const saved = db.site_content!.find((r) => r.key === 'benefits')!.value as { title: string }[];
  expect(saved[0]!.title).toBe('Reparación exprés');

  // Public page reads the published content.
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('benefits').getByText('Reparación exprés').first()).toBeVisible();
});

test('public forms store leads in the database and catch duplicates from any device', async ({ page }) => {
  const { db } = await fakeSupabase(page, { waitlist: [{ id: 'w1', email: 'ya@example.com', zone: null, source: 'landing', created_at: day(1) }] });
  await page.route('https://formsubmit.co/ajax/**', (r) => r.fulfill({ json: { success: 'true' } }));
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Avísame' }).click();
  await page.getByLabel('Tu email').fill('YA@example.com');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Este email ya está en la lista de espera.')).toBeVisible();
  await page.getByLabel('Tu email').fill('nueva@example.com');
  await page.getByLabel('Tu zona').selectOption('rivas');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('¡Estás dentro!')).toBeVisible();
  expect(db.waitlist_leads!.at(-1)).toMatchObject({ email: 'nueva@example.com', zone: 'Rivas-Vaciamadrid', source: 'landing' });
});
