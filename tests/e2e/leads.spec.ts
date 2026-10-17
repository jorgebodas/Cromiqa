import { expect, test, type Route } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const ok = (bodies: Record<string, string>[]) => async (route: Route) => {
  bodies.push(route.request().postDataJSON());
  await route.fulfill({ json: { success: 'true', message: 'The form was submitted successfully.' } });
};

test('waitlist validates, submits to FormSubmit and confirms', async ({ page }) => {
  const bodies: Record<string, string>[] = [];
  await page.route('https://formsubmit.co/ajax/**', ok(bodies));
  const form = page.getByTestId('waitlist-form');
  await form.getByRole('button', { name: 'Avísame' }).click();
  await expect(form.getByText('Escribe un email válido.')).toBeVisible();
  expect(bodies).toHaveLength(0);

  await form.getByLabel('Tu email').fill('ciclista@example.com');
  await form.getByLabel('Tu zona').selectOption('rivas');
  await form.getByRole('button', { name: 'Avísame' }).click();
  await expect(page.getByText('¡Apuntado!')).toBeVisible();
  expect(bodies[0]).toMatchObject({ email: 'ciclista@example.com', zona: 'Rivas-Vaciamadrid', tipo: 'Lista de espera', _honey: '' });

  await page.reload(); // remembered on this device
  await expect(page.getByText('¡Apuntado!')).toBeVisible();
});

test('waitlist shows an error when the service fails', async ({ page }) => {
  await page.route('https://formsubmit.co/ajax/**', (route) => route.fulfill({ status: 500, json: { success: 'false' } }));
  const form = page.getByTestId('waitlist-form');
  await form.getByLabel('Tu email').fill('ciclista@example.com');
  await form.getByRole('button', { name: 'Avísame' }).click();
  await expect(form.getByText('No hemos podido enviarlo.')).toBeVisible();
});

test('mechanic form uses progressive disclosure and validates', async ({ page }) => {
  const bodies: Record<string, string>[] = [];
  await page.route('https://formsubmit.co/ajax/**', ok(bodies));
  await page.getByRole('button', { name: 'Quiero unirme' }).click();
  const form = page.getByTestId('mechanic-form');
  await form.getByRole('button', { name: 'Enviar' }).click();
  await expect(form.getByText('Escribe tu nombre.')).toBeVisible();
  await expect(form.getByText('Elige tu zona principal.')).toBeVisible();

  await form.getByLabel('Nombre').fill('Rosa Gil');
  await form.getByLabel(/Taller o negocio/).fill('Taller Rosa');
  await form.getByLabel('Email').fill('rosa@example.com');
  await form.getByLabel('Zona principal').selectOption('arganda');
  await form.getByLabel(/Especialidad/).fill('MTB y eléctricas');
  await form.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('¡Gracias!')).toBeVisible();
  expect(bodies[0]).toMatchObject({ nombre: 'Rosa Gil', taller: 'Taller Rosa', zona: 'Arganda del Rey', tipo: 'Mecánico', telefono: '—' });
});

test('demo panel sends the FormSubmit activation from the browser', async ({ page }) => {
  const urls: string[] = [];
  await page.route('https://formsubmit.co/ajax/**', async (route) => {
    urls.push(route.request().url());
    await route.fulfill({ json: { success: 'false', message: 'This form needs Activation.' } });
  });
  await page.evaluate(() => localStorage.setItem('cromiqa:access', 'a4c7c39e9911444f184e4b3cbb271dfc46954288f89badfa62474431144684b3'));
  await page.goto('./#/demo');
  await page.reload();
  await page.getByLabel('Email donde recibir los registros').fill('owner@example.com');
  await page.getByRole('button', { name: 'Enviar activación' }).click();
  await expect(page.getByText('Revisa tu bandeja')).toBeVisible();
  expect(urls[0]).toBe('https://formsubmit.co/ajax/owner%40example.com');
});
