import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, statusTitle, switchAccount } from './helpers';

const caseStatus = (page: import('@playwright/test').Page) => page.getByTestId('case-status');

test.describe('Escenarios A, B y C: reparación de principio a fin', () => {
  test('guest sends a repair to two mechanics, one quotes, owner hires, the other is closed, job completes', async ({ page }) => {
    await freshDemo(page);

    // A — start from the need: the request comes first, mechanics are chosen later.
    await page.getByTestId('widget-need').getByRole('button', { name: 'Reparación' }).click();
    await expect(page).toHaveURL(/#\/solicitar/);
    await expect(page.getByText('Paso 1 de 5')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Reparación/ })).toBeChecked();
    await page.getByLabel('Describe el problema').fill('Los cambios saltan al subir y la cadena hace ruido en los piñones grandes.');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 2 de 5')).toBeVisible();
    await page.locator('label', { hasText: 'Montaña (MTB)' }).click();
    await page.getByLabel('Marca').fill('Orbea');
    await page.getByLabel('Modelo').fill('Alma H50');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 3 de 5')).toBeVisible();
    await page.getByLabel('Zona', { exact: true }).selectOption('rivas');
    await page.locator('label', { hasText: 'A domicilio' }).click();
    await page.getByRole('button', { name: /^Tarde/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Choose recipients: nothing preselected, Carlos plus one more.
    await expect(page.getByText('Paso 4 de 5')).toBeVisible();
    await expect(page.getByTestId('selected-count')).toHaveText('0 de 5 seleccionados');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Elige al menos un mecánico')).toBeVisible();
    const options = page.getByTestId('provider-option');
    await options.filter({ hasText: 'Carlos Ortega' }).click();
    const other = options.filter({ hasNotText: 'Carlos Ortega' }).first();
    const otherName = (await other.locator('.font-semibold').first().innerText()).trim();
    await other.click();
    await expect(page.getByTestId('selected-count')).toHaveText('2 de 5 seleccionados');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Paso 5 de 5')).toBeVisible();
    await expect(page.getByText('Orbea Alma H50')).toBeVisible();
    await expect(page.getByTestId('review-recipients')).toContainText('Carlos Ortega');
    await expect(page.getByTestId('review-recipients')).toContainText(otherName);
    // Guest chooses a demo owner account instead of signing up
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByText('Elige con qué cuenta de demostración')).toBeVisible();
    await page.locator('label', { hasText: 'Ana López' }).click();
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByTestId('sent-title')).toHaveText('Solicitud enviada a 2 mecánicos');
    await expect(page.getByTestId('sent-recipients')).toContainText('Carlos Ortega');
    await page.getByRole('link', { name: 'Ver mi solicitud' }).click();
    await expect(caseStatus(page)).toHaveText('Esperando respuestas');
    await expect(page.getByTestId('response-row')).toHaveCount(2);
    const caseUrl = page.url();

    await page.goto('./#/solicitudes');
    await expect(page.getByTestId('case-card').filter({ hasText: 'Orbea Alma H50' })).toContainText('Enviada a 2 mecánicos');

    // B — Carlos answers with a closed quote
    await switchAccount(page, 'Carlos Ortega');
    await expect(page).toHaveURL(/#\/pro$/);
    await page.goto('./#/pro/solicitudes?estado=nuevas');
    await page.getByTestId('request-card').filter({ hasText: 'Orbea Alma H50' }).click();
    await expect(page.getByText('Los cambios saltan al subir')).toBeVisible();
    await expect(page.getByText('A domicilio · Rivas-Vaciamadrid')).toBeVisible();
    await expect(page.getByTestId('chat-locked')).toBeVisible();
    await page.getByTestId('respond-options').getByRole('button', { name: 'Presupuesto cerrado' }).click();
    const proposal = page.getByTestId('proposal-form');
    await proposal.getByLabel('Precio total (€)').fill('45');
    await proposal.getByLabel('Hora').fill('18:30');
    await proposal.getByLabel('Mensaje para el cliente').fill('Ajuste de desviador y cable nuevo. Paso por tu casa.');
    await proposal.getByRole('button', { name: 'Enviar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Presupuesto enviado');

    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await expect(statusTitle(page)).toHaveText('Presupuesto recibido');
    await expect(page.getByTestId('proposal-price').first()).toHaveText(/45/);
    await expect(page.getByTestId('chat-locked')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Confirmada');
    await expect(page.getByText('Cita confirmada').first()).toBeVisible();
    await expect(page.getByTestId('chat-locked')).toHaveCount(0);
    const threadUrl = page.url();

    // Only one booking: the other invitation is closed as not selected.
    await page.goto(caseUrl);
    await expect(caseStatus(page)).toHaveText('Servicio contratado');
    await expect(page.getByTestId('hired-card')).toContainText('Carlos Ortega');
    await expect(page.getByTestId('response-row').filter({ hasText: otherName })).toContainText('No seleccionado');

    // C — completion
    await page.getByTestId('hired-card').click();
    await page.getByRole('button', { name: 'Ver como Carlos' }).click();
    await page.getByRole('button', { name: 'Marcar en curso' }).click();
    await expect(statusTitle(page)).toHaveText('En curso');
    await page.getByRole('button', { name: 'Marcar como completado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Completar trabajo' });
    await dialog.getByLabel('Resumen del trabajo').fill('Cable y funda nuevos, patilla enderezada y desviador ajustado.');
    await dialog.getByRole('button', { name: 'Marcar como completado' }).click();
    await expect(statusTitle(page)).toHaveText('Completada');

    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await expect(page).toHaveURL(threadUrl);
    await expect(statusTitle(page)).toHaveText('Completada');
    await page.getByRole('link', { name: /Ver historial de/ }).click();
    await expect(page.getByRole('heading', { name: 'Orbea Alma H50' })).toBeVisible();
    await expect(page.getByTestId('maintenance-record').first()).toContainText('patilla enderezada');

    // Everything survives a reload
    await page.reload();
    await expect(page.getByTestId('maintenance-record').first()).toContainText('patilla enderezada');
    await page.goto('./#/solicitudes?x=1');
    await page.getByRole('tab', { name: /Completadas/ }).click();
    await expect(page.getByTestId('case-card').filter({ hasText: 'Orbea Alma H50' })).toContainText('Completada');
  });
});

test.describe('Varios mecánicos por solicitud', () => {
  test('the request hub compares quotes; rejecting one closes only that invitation', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await page.goto('./#/solicitudes/r-03');
    await expect(caseStatus(page)).toHaveText('Propuestas recibidas');
    const rows = page.getByTestId('response-row');
    await expect(rows).toHaveCount(2);
    // Cheapest quote first.
    await expect(rows.first()).toContainText('Carlos Ortega');
    await expect(rows.first()).toContainText('40');
    await expect(rows.nth(1)).toContainText('Nerea Campos');

    await rows.first().click();
    await page.getByRole('button', { name: 'Rechazar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rechazar presupuesto' });
    await dialog.getByLabel(/Motivo/).fill('Se me va de presupuesto.');
    await dialog.getByRole('button', { name: 'Rechazar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Cancelada');

    await page.goto('./#/solicitudes/r-03');
    await expect(caseStatus(page)).toHaveText('Propuestas recibidas');
    await expect(rows.filter({ hasText: 'Nerea Campos' })).toContainText('50');

    await switchAccount(page, 'Carlos Ortega');
    await page.goto('./#/pro/solicitudes/r-03');
    await expect(page.getByTestId('quote-rejected')).toContainText('Se me va de presupuesto');
    await expect(page.getByTestId('respond-options')).toHaveCount(0);
  });

  test('accepting one quote closes the others as not selected', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await page.goto('./#/solicitudes/r-03');
    await page.getByTestId('response-row').filter({ hasText: 'Nerea Campos' }).click();
    await expect(page.getByText('las demás invitaciones de esta solicitud se cerrarán')).toBeVisible();
    await page.getByRole('button', { name: 'Aceptar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Confirmada');

    await page.goto('./#/solicitudes/r-03');
    await expect(caseStatus(page)).toHaveText('Servicio contratado');
    await expect(page.getByTestId('hired-card')).toContainText('Nerea Campos');
    await expect(page.getByTestId('response-row').filter({ hasText: 'Carlos Ortega' })).toContainText('No seleccionado');
    await expect(page.getByRole('button', { name: 'Invitar a más mecánicos' })).toHaveCount(0);

    await switchAccount(page, 'Carlos Ortega');
    await page.goto('./#/pro/solicitudes/r-03');
    await expect(page.getByTestId('not-selected')).toBeVisible();
    await page.goto('./#/pro/solicitudes?estado=cerradas');
    await expect(page.getByTestId('request-card').filter({ hasText: 'CRQ-1010' })).toBeVisible();
  });

  test('inviting more mechanics adds invitations without duplicates', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/solicitudes/r-01');
    await expect(page.getByTestId('response-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Invitar a más mecánicos' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Invitar a más mecánicos' });
    const options = dialog.getByTestId('provider-option');
    await expect(options.first()).toBeVisible();
    await expect(options.filter({ hasText: 'Carlos Ortega' })).toHaveCount(0);
    await options.first().click();
    await dialog.getByRole('button', { name: 'Invitar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('response-row')).toHaveCount(2);
    await expect(page.getByTestId('response-row').filter({ hasText: 'Pendiente de respuesta' })).toHaveCount(2);
  });

  test('open proposal: opens the chat before any price, without hiring anyone', async ({ page }) => {
    // Seeded: Carlos asked Diego a question on r-02.
    await freshDemo(page, 'u-diego');
    await page.goto('./#/solicitudes/r-02');
    await page.getByTestId('response-row').first().click();
    await expect(page.getByTestId('open-proposal')).toBeVisible();
    await expect(page.getByTestId('chat-locked')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aceptar presupuesto' })).toHaveCount(0);

    // Carlos sends one on a new invitation: the chat opens for both.
    await switchAccount(page, 'Carlos Ortega');
    await page.goto('./#/pro/solicitudes/r-01');
    await expect(page.getByTestId('chat-locked')).toBeVisible();
    await page.getByTestId('respond-options').getByRole('button', { name: 'Propuesta abierta' }).click();
    const form = page.getByTestId('open-proposal-form');
    await form.getByLabel('Qué necesitas saber').fill('¿Me mandas una foto del cambio por detrás?');
    await form.getByRole('button', { name: 'Enviar propuesta abierta' }).click();
    await expect(page.getByTestId('open-proposal')).toBeVisible();
    await expect(page.getByTestId('chat-locked')).toHaveCount(0);
    await expect(statusTitle(page)).toHaveText('Propuesta abierta');
  });

  test('a mechanic can revise a pending quote; the new version needs approval', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro/solicitudes/r-03');
    await page.getByRole('button', { name: 'Revisar presupuesto' }).click();
    const form = page.getByTestId('proposal-form');
    await expect(form).toContainText('versión 2');
    await form.getByLabel('Precio total (€)').fill('35');
    await form.getByRole('button', { name: 'Enviar revisión' }).click();
    await expect(page.getByTestId('proposal-card')).toContainText('versión 2');

    await page.getByRole('button', { name: 'Ver como Pablo' }).click();
    await expect(page.getByTestId('proposal-card').first()).toContainText('versión 2');
    await expect(page.getByTestId('proposal-price').first()).toHaveText(/35/);
    await expect(page.getByText('ha revisado su presupuesto; necesita tu aprobación')).toBeVisible();
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
  await expect(page.getByText('Paso 1 de 5')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Inspección antes de comprar/ })).toBeEnabled();
});

test('Escenario E: inspección antes de comprar, empezando desde el perfil de Nerea', async ({ page }) => {
  await freshDemo(page, 'u-pablo');
  await page.goto('./#/mecanicos/m-nerea');
  await page.getByRole('link', { name: /^Solicitar servicio/ }).filter({ visible: true }).first().click();
  await page.getByRole('radio', { name: /Inspección antes de comprar/ }).check({ force: true });
  await page.getByLabel('Describe el problema').fill('Quiero comprar una doble suspensión usada en Rivas.');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'La bici que quieres comprar' })).toBeVisible();
  await page.locator('label', { hasText: 'Montaña (MTB)' }).click();
  await page.getByLabel('Marca').fill('Specialized');
  await page.getByLabel('Modelo').fill('Stumpjumper Comp');
  await page.getByLabel(/Precio que piden/).fill('1200');
  await page.getByLabel(/¿Dónde está la bici?/).fill('Rivas Urbanizaciones');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByLabel('Zona', { exact: true }).selectOption('rivas');
  await page.locator('label', { hasText: 'A domicilio' }).click();
  await page.getByText('Tengo flexibilidad').click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // The provider the request started from comes preselected; Lucía doesn't do inspections.
  await expect(page.getByTestId('provider-option').filter({ hasText: 'Nerea Campos' }).locator('input')).toBeChecked();
  await expect(page.getByTestId('provider-option').filter({ hasText: 'Lucía Ferrer' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Precio pedido: 1200 €')).toBeVisible();

  // Edit a previous answer from the review step
  await page.getByRole('button', { name: 'Editar: La bici que quieres comprar' }).click();
  await page.getByLabel('Modelo').fill('Stumpjumper Evo');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Specialized Stumpjumper Evo')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await expect(page.getByTestId('sent-title')).toHaveText('Solicitud enviada a Nerea');
  await page.getByRole('link', { name: 'Ver mi solicitud' }).click();
  await expect(caseStatus(page)).toHaveText('Esperando respuestas');
  await expect(page.getByText('Bici a inspeccionar')).toBeVisible();
  await expect(page.getByText('Precio pedido: 1200 €')).toBeVisible();
});
