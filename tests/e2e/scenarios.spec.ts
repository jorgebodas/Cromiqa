import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, statusTitle, switchAccount } from './helpers';

test.describe('Escenarios A, B y C: reparación de principio a fin', () => {
  test('guest requests a home repair, mechanic proposes, owner accepts, job completes', async ({ page }) => {
    await freshDemo(page);

    // A — problem-first request from the home page
    const form = page.locator('form', { has: page.getByRole('heading', { name: '¿Qué necesita tu bici?' }) });
    await form.getByText('Reparación', { exact: true }).click();
    await form.getByLabel('Cuéntanos qué le pasa').fill('Los cambios saltan al subir y la cadena hace ruido en los piñones grandes.');
    await form.getByLabel('¿Dónde?').selectOption('rivas');
    await form.getByLabel('Tipo de bici').selectOption('mtb');
    await form.getByText('A domicilio', { exact: true }).click();
    await form.getByRole('button', { name: 'Buscar mecánicos' }).click();

    await expect(page).toHaveURL(/mecanicos/);
    await expect(page.getByText('Tu necesidad: Reparación')).toBeVisible();
    const cards = page.getByTestId('mechanic-card');
    await expect(cards.first()).toContainText('Carlos Ortega'); // transmission specialist ranked first
    await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Lucía Ferrer' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Solicitar servicio a Carlos Ortega' }).click();

    await expect(page.getByText('Paso 1 de 4')).toBeVisible();
    await expect(page.getByLabel('Describe el problema')).toHaveValue(/cambios saltan/);
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 2 de 4')).toBeVisible();
    await page.locator('label', { hasText: 'Montaña (MTB)' }).click();
    await page.getByLabel('Marca').fill('Orbea');
    await page.getByLabel('Modelo').fill('Alma H50');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 3 de 4')).toBeVisible();
    await expect(page.getByLabel('Zona', { exact: true })).toHaveValue('rivas');
    await expect(page.getByRole('radio', { name: /A domicilio/ })).toBeChecked();
    await page.getByRole('button', { name: /^Tarde/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 4 de 4')).toBeVisible();
    await expect(page.getByText('Orbea Alma H50')).toBeVisible();
    await expect(page.getByText('Esto no es una reserva.')).toBeVisible();
    // Guest chooses a demo owner account instead of signing up
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByText('Elige con qué cuenta de demostración')).toBeVisible();
    await page.locator('label', { hasText: 'Ana López' }).click();
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByRole('heading', { name: 'Solicitud enviada a Carlos' })).toBeVisible();
    await expect(page.getByText('Todavía no es una cita confirmada.')).toBeVisible();
    await page.getByRole('link', { name: 'Ver mi solicitud' }).click();
    await expect(statusTitle(page)).toHaveText('Solicitud enviada');
    const requestUrl = page.url();

    await page.goto('./#/solicitudes');
    await expect(page.getByTestId('request-card').filter({ hasText: 'Orbea Alma H50' })).toBeVisible();

    // B — mechanic responds
    await switchAccount(page, 'Carlos Ortega');
    await expect(page).toHaveURL(/#\/pro$/);
    await page.goto('./#/pro/solicitudes?estado=nuevas');
    await page.getByTestId('request-card').filter({ hasText: 'Orbea Alma H50' }).click();
    await expect(page.getByText('Los cambios saltan al subir')).toBeVisible();
    await expect(page.getByText('A domicilio · Rivas-Vaciamadrid')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar para valorar' }).click();
    await expect(statusTitle(page)).toHaveText('Esperando propuesta');

    const proposal = page.getByTestId('proposal-form');
    await proposal.getByLabel('Precio total (€)').fill('45');
    await proposal.getByLabel('Hora').fill('18:30');
    await proposal.getByLabel('Mensaje para el cliente').fill('Ajuste de desviador y cable nuevo. Paso por tu casa.');
    await proposal.getByRole('button', { name: 'Enviar propuesta' }).click();
    await expect(statusTitle(page)).toHaveText('Propuesta enviada');

    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await expect(statusTitle(page)).toHaveText('Propuesta recibida');
    await expect(page.getByTestId('proposal-price').first()).toHaveText(/45/);
    await page.getByRole('button', { name: 'Aceptar propuesta' }).click();
    await expect(statusTitle(page)).toHaveText('Confirmada');
    await expect(page.getByText('Cita confirmada').first()).toBeVisible();

    // C — completion
    await page.getByRole('button', { name: 'Ver como Carlos' }).click();
    await page.getByRole('button', { name: 'Marcar en curso' }).click();
    await expect(statusTitle(page)).toHaveText('En curso');
    await page.getByRole('button', { name: 'Marcar como completado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Completar trabajo' });
    await dialog.getByLabel('Resumen del trabajo').fill('Cable y funda nuevos, patilla enderezada y desviador ajustado.');
    await dialog.getByRole('button', { name: 'Marcar como completado' }).click();
    await expect(statusTitle(page)).toHaveText('Completada');

    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await expect(page).toHaveURL(requestUrl);
    await expect(statusTitle(page)).toHaveText('Completada');
    await page.getByRole('link', { name: /Ver historial de/ }).click();
    await expect(page.getByRole('heading', { name: 'Orbea Alma H50' })).toBeVisible();
    await expect(page.getByTestId('maintenance-record').first()).toContainText('patilla enderezada');

    // Everything survives a reload
    await page.reload();
    await expect(page.getByTestId('maintenance-record').first()).toContainText('patilla enderezada');
    await page.goto('./#/solicitudes?x=1');
    await page.getByRole('tab', { name: /Completadas/ }).click();
    await expect(page.getByTestId('request-card').filter({ hasText: 'Orbea Alma H50' })).toContainText('Completada');
  });

  test('owner can reject a proposal and the mechanic can send a new one', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await page.goto('./#/solicitudes/r-03');
    await page.getByRole('button', { name: 'Rechazar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rechazar propuesta' });
    await dialog.getByLabel(/Motivo/).fill('Se me va de presupuesto.');
    await dialog.getByRole('button', { name: 'Rechazar propuesta' }).click();
    await expect(statusTitle(page)).toHaveText('Esperando propuesta');
    await page.getByRole('button', { name: 'Ver como Carlos' }).click();
    await expect(page.getByText('Pablo rechazó tu propuesta anterior')).toBeVisible();
    await expect(page.getByTestId('proposal-form')).toBeVisible();
  });
});

test('Escenario D: especialistas en suspensión a domicilio', async ({ page }) => {
  await freshDemo(page);
  await page.goto('./#/mecanicos');
  await page.getByRole('searchbox', { name: /Buscar/ }).fill('suspensión');
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Filtros' });
    await dialog.locator('label', { hasText: 'Domicilio' }).click();
    await dialog.getByRole('button', { name: /^Ver \d+ resultado/ }).click();
  } else {
    await page.getByLabel('Filtros').locator('label', { hasText: 'Domicilio' }).click();
  }
  await expect(page).toHaveURL(/q=suspensi/);
  await expect(page).toHaveURL(/modalidad=domicilio/);
  const cards = page.getByTestId('mechanic-card');
  await expect(cards.filter({ hasText: 'Nerea Campos' })).toBeVisible();
  await expect(cards.filter({ hasText: 'Marta Ibáñez' })).toHaveCount(0);
  await expect(cards.filter({ hasText: 'Andrés Vidal' })).toHaveCount(0);
  await expect(page.getByTestId('results-count')).toHaveText('3 mecánicos');

  await cards.filter({ hasText: 'Nerea Campos' }).getByRole('link', { name: 'Ver perfil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nerea Campos' })).toBeVisible();
  await expect(page.getByText('Servicio completo de horquilla', { exact: true })).toBeVisible();
  await expect(page.getByText('Ficticio').filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('link', { name: /^Solicitar servicio/ }).filter({ visible: true }).first().click();
  await expect(page.getByText('Paso 1 de 4')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Inspección antes de comprar/ })).toBeEnabled();
});

test('Escenario E: inspección antes de comprar', async ({ page }) => {
  await freshDemo(page, 'u-pablo');
  const form = page.locator('form', { has: page.getByRole('heading', { name: '¿Qué necesita tu bici?' }) });
  await form.getByText('Inspección antes de comprar', { exact: true }).click();
  await form.getByLabel('Cuéntanos qué le pasa').fill('Quiero comprar una doble suspensión usada en Rivas.');
  await form.getByLabel('¿Dónde?').selectOption('rivas');
  await form.getByRole('button', { name: 'Buscar mecánicos' }).click();

  const cards = page.getByTestId('mechanic-card');
  await expect(cards.filter({ hasText: 'Lucía Ferrer' })).toHaveCount(0); // no inspections
  await page.getByRole('link', { name: 'Solicitar servicio a Nerea Campos' }).click();
  await expect(page.getByRole('radio', { name: /Inspección antes de comprar/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'La bici que quieres comprar' })).toBeVisible();
  await page.locator('label', { hasText: 'Montaña (MTB)' }).click();
  await page.getByLabel('Marca').fill('Specialized');
  await page.getByLabel('Modelo').fill('Stumpjumper Comp');
  await page.getByLabel(/Precio que piden/).fill('1200');
  await page.getByLabel(/¿Dónde está la bici?/).fill('Rivas Urbanizaciones');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('label', { hasText: 'A domicilio' }).click();
  await page.getByText('Tengo flexibilidad').click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Precio pedido: 1200 €')).toBeVisible();

  // Edit a previous answer from the review step
  await page.getByRole('button', { name: 'Editar: La bici que quieres comprar' }).click();
  await page.getByLabel('Modelo').fill('Stumpjumper Evo');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Specialized Stumpjumper Evo')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await expect(page.getByRole('heading', { name: 'Solicitud enviada a Nerea' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver mi solicitud' }).click();
  await expect(statusTitle(page)).toHaveText('Solicitud enviada');
  await expect(page.getByText('Bici a inspeccionar')).toBeVisible();
  await expect(page.getByText('Precio pedido: 1200 €')).toBeVisible();
});
