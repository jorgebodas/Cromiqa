import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, statusTitle, switchAccount } from './helpers';


test.describe('Escenarios A, B y C: reparación de principio a fin', () => {
  test('a guest picks a service on Home, sends it to one mechanic, hires them and the job completes', async ({ page }) => {
    await freshDemo(page);

    // A — Home's service carousel opens the request flow with the service already chosen.
    await expect(page.getByTestId('service-card')).toHaveCount(6);
    await page.getByTestId('service-card').filter({ hasText: 'Transmisión' }).click();
    const hub = page.getByTestId('request-hub');
    await expect(hub.getByText('Paso 1 de 7')).toBeVisible();
    await expect(hub.getByTestId('topic-chip')).toHaveText('Transmisión');
    await expect(hub.getByRole('radio', { name: /^Reparación/ })).toBeChecked();
    await hub.getByLabel('Describe el problema').fill('Los cambios saltan al subir y la cadena hace ruido en los piñones grandes.');
    await hub.getByRole('button', { name: 'Continuar' }).click();

    await expect(hub.getByText('Paso 2 de 7')).toBeVisible();
    await hub.locator('label', { hasText: 'Montaña (MTB)' }).click();
    await hub.getByLabel('Marca').fill('Orbea');
    await hub.getByLabel('Modelo').fill('Alma H50');
    await hub.getByRole('button', { name: 'Continuar' }).click();

    // Photos are optional.
    await expect(hub.getByText('Paso 3 de 7')).toBeVisible();
    await hub.getByRole('button', { name: 'Continuar' }).click();

    await expect(hub.getByText('Paso 4 de 7')).toBeVisible();
    await hub.getByLabel('Zona', { exact: true }).selectOption('rivas');
    await hub.locator('label', { hasText: 'A domicilio' }).click();
    await hub.getByRole('button', { name: 'Continuar' }).click();

    await expect(hub.getByText('Paso 5 de 7')).toBeVisible();
    await hub.getByRole('button', { name: /^Tarde/ }).click();
    await hub.getByRole('button', { name: 'Continuar' }).click();

    // One mechanic: nothing preselected; picking another replaces the choice.
    await expect(hub.getByText('Paso 6 de 7')).toBeVisible();
    await expect(hub.getByTestId('hub-primary')).toHaveAttribute('aria-disabled', 'true');
    await hub.getByRole('button', { name: 'Continuar' }).click({ force: true });
    await expect(hub.getByText('Elige al menos un mecánico')).toBeVisible();
    const options = hub.getByTestId('provider-option');
    await options.filter({ hasNotText: 'Carlos Ortega' }).first().click();
    await options.filter({ hasText: 'Carlos Ortega' }).click();
    await expect(hub.locator('[data-testid="provider-option"] input:checked')).toHaveCount(1);
    await hub.getByRole('button', { name: 'Continuar' }).click();

    await expect(hub.getByText('Paso 7 de 7')).toBeVisible();
    await expect(hub.getByText('Orbea Alma H50')).toBeVisible();
    await expect(hub.getByTestId('review-recipients').getByRole('listitem')).toHaveCount(1);
    await expect(hub.getByTestId('review-recipients')).toContainText('Carlos Ortega');
    // Guest chooses a demo owner account instead of signing up
    await expect(hub.getByTestId('hub-primary')).toHaveAttribute('aria-disabled', 'true');
    await hub.getByRole('button', { name: 'Enviar solicitud' }).click({ force: true });
    await expect(hub.getByText('Elige con qué cuenta de demostración')).toBeVisible();
    await hub.locator('label', { hasText: 'Ana López' }).click();
    await hub.getByRole('button', { name: 'Enviar solicitud' }).click();

    // Sent: the panel closes and the request shows up in Solicitudes, named after the service.
    await expect(hub).toHaveCount(0);
    await page.goto('./#/solicitudes');
    const card = page.getByTestId('case-card').filter({ hasText: 'Orbea Alma H50' });
    await expect(card).toContainText('Transmisión');
    await expect(card).toContainText('Carlos Ortega');
    await expect(card).toContainText('Solicitud enviada');
    await card.click();
    // The request is the conversation with its one mechanic.
    await expect(page).toHaveURL(/\/mecanico\//);
    await expect(statusTitle(page)).toHaveText('Solicitud enviada');

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
    await expect(statusTitle(page)).toHaveText('Contratado');
    // Hiring is not an appointment: Carlos's date is a proposal Ana confirms.
    await expect(page.getByTestId('appointment-confirmed')).toHaveCount(0);
    await expect(page.getByTestId('appointment-pending')).toContainText('Carlos propone');
    await expect(page.getByTestId('chat-locked')).toHaveCount(0);
    await page.getByRole('button', { name: 'Confirmar cita' }).click();
    await expect(page.getByTestId('appointment-confirmed')).toContainText('18:30');
    const threadUrl = page.url();

    // C — completion
    await page.getByRole('button', { name: 'Ver como Carlos' }).click();
    await page.getByRole('button', { name: 'Empezar trabajo' }).click();
    await expect(statusTitle(page)).toHaveText('En curso');
    await page.getByRole('button', { name: 'Trabajo terminado' }).click();
    const dialog = page.getByRole('dialog', { name: 'Trabajo terminado' });
    await dialog.getByLabel('Resumen del trabajo').fill('Cable y funda nuevos, patilla enderezada y desviador ajustado.');
    await dialog.getByRole('button', { name: 'Marcar como terminado' }).click();
    await expect(statusTitle(page)).toHaveText('Por confirmar');

    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await expect(page).toHaveURL(threadUrl);
    await expect(page.getByTestId('auto-close-note')).toContainText('se cerrará automáticamente');
    await page.getByRole('button', { name: 'Confirmar que está terminado' }).click();
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

test.describe('Una solicitud, un mecánico', () => {
  test('two requests to two mechanics are independent: rejecting one leaves the other open', async ({ page }) => {
    // Pablo asked Carlos (r-03) and Nerea (r-13) about the same bike: two requests.
    await freshDemo(page, 'u-pablo');
    await page.goto('./#/solicitudes');
    await expect(page.getByTestId('case-card').filter({ hasText: 'Carlos Ortega' })).toContainText('40');
    await expect(page.getByTestId('case-card').filter({ hasText: 'Nerea Campos' })).toContainText('50');
    // A request opens straight on its mechanic: no list of responses, no comparison, no "invite more".
    await page.goto('./#/solicitudes/r-03');
    await expect(page).toHaveURL(/\/solicitudes\/r-03\/mecanico\/r-03$/);
    await expect(page.getByTestId('response-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Invitar a más/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Rechazar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rechazar presupuesto' });
    await dialog.getByLabel(/Motivo/).fill('Se me va de presupuesto.');
    await dialog.getByRole('button', { name: 'Rechazar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Cancelada');

    await page.goto('./#/solicitudes/r-13');
    await expect(statusTitle(page)).toHaveText('Presupuesto recibido');
    // Accepting Nerea's doesn't close anything else.
    await page.getByRole('button', { name: 'Aceptar presupuesto' }).click();
    await expect(statusTitle(page)).toHaveText('Contratado');

    await switchAccount(page, 'Carlos Ortega');
    await page.goto('./#/pro/solicitudes/r-03');
    await expect(page.getByTestId('quote-rejected')).toContainText('Se me va de presupuesto');
    await expect(page.getByTestId('respond-options')).toHaveCount(0);
  });

  test('open proposal: opens the chat before any price, without hiring anyone', async ({ page }) => {
    // Seeded: Carlos asked Diego a question on r-02.
    await freshDemo(page, 'u-diego');
    await page.goto('./#/solicitudes/r-02');
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

test.describe('Después de contratar', () => {
  test('appointment: counter-proposal, then the other side confirms; work can only start with a date', async ({ page }) => {
    // r-04: Javier proposed a date when quoting; Diego hasn't confirmed.
    await freshDemo(page, 'u-diego');
    await expect(page.getByTestId('attention-appointment')).toContainText('Javier Molina propone una cita');
    await page.goto('./#/solicitudes/r-04/mecanico/r-04');
    await expect(page.getByTestId('appointment-pending')).toContainText('Javier propone');
    await page.getByRole('button', { name: 'Proponer otra fecha' }).click();
    const dialog = page.getByRole('dialog', { name: 'Proponer fecha' });
    await dialog.getByLabel('Hora').fill('09:15');
    await dialog.getByRole('button', { name: 'Enviar propuesta' }).click();
    await expect(page.getByTestId('appointment-pending')).toContainText('Esperando a que Javier la confirme');

    await switchAccount(page, 'Javier Molina');
    await page.goto('./#/pro/solicitudes/r-04');
    await expect(page.getByRole('button', { name: 'Empezar trabajo' })).toBeDisabled();
    await page.getByRole('button', { name: 'Confirmar cita' }).click();
    await expect(page.getByTestId('appointment-confirmed')).toContainText('09:15');
    await expect(page.getByRole('button', { name: 'Empezar trabajo' })).toBeEnabled();
  });

  test('finished work: reporting a problem pauses the 72 h closure until it is resolved', async ({ page }) => {
    // r-14: Carlos finished 50 h ago; it would close in about 22 h.
    await freshDemo(page, 'u-ana');
    const card = page.getByTestId('attention-confirm');
    await expect(card).toContainText('menos de 24 h');
    await card.click();
    await expect(statusTitle(page)).toHaveText('Por confirmar');
    await page.getByRole('button', { name: 'Reportar un problema' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reportar un problema' });
    await dialog.getByLabel('Qué ha pasado').fill('La maneta vuelve a irse hasta el puño tras una salida.');
    await dialog.getByRole('button', { name: 'Reportar problema' }).click();
    await expect(page.getByTestId('incident-card')).toContainText('El cierre automático está en pausa');

    await page.getByRole('button', { name: 'Ver como Carlos' }).click();
    await expect(page.getByTestId('incident-card')).toContainText('La maneta vuelve a irse');
    await page.getByRole('button', { name: 'Ver como Ana' }).click();
    await page.getByRole('button', { name: 'Está resuelto: confirmar' }).click();
    await expect(statusTitle(page)).toHaveText('Completada');
  });

  test('cancelling a hired service needs a reason', async ({ page }) => {
    await freshDemo(page, 'u-diego');
    await page.goto('./#/solicitudes/r-11/mecanico/r-11');
    await page.getByRole('button', { name: 'Cancelar servicio' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancelar servicio' });
    await dialog.getByRole('button', { name: 'Cancelar servicio' }).click();
    await expect(dialog.getByText('Indica el motivo.')).toBeVisible();
    await dialog.getByLabel(/Motivo/).fill('Me ha surgido un viaje de trabajo.');
    await dialog.getByRole('button', { name: 'Cancelar servicio' }).click();
    await expect(statusTitle(page)).toHaveText('Cancelada');
  });

  test('the 72 h closure survives a reload and is labelled as administrative', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    // Move r-14's finish time back past the deadline, as if the app had been closed for days.
    await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('cromiqa:demo:db')!);
      const r = db.requests.find((x: { id: string }) => x.id === 'r-14');
      r.finishedAt = new Date(Date.now() - 80 * 3600_000).toISOString();
      localStorage.setItem('cromiqa:demo:db', JSON.stringify(db));
    });
    await page.goto('./#/solicitudes/r-14/mecanico/r-14');
    await page.reload();
    await expect(statusTitle(page)).toHaveText('Completada');
    await expect(page.getByTestId('auto-closed')).toContainText('No implica conformidad');
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
  await expect(page.getByText('Paso 1 de 7')).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Inspección/ })).toBeEnabled();
});

test('Escenario E: inspección antes de comprar, empezando desde el perfil de Nerea', async ({ page }) => {
  await freshDemo(page, 'u-pablo');
  await page.goto('./#/mecanicos/m-nerea');
  await page.getByRole('link', { name: /^Solicitar servicio/ }).filter({ visible: true }).first().click();
  await page.getByRole('radio', { name: /^Inspección/ }).check({ force: true });
  await page.getByLabel('Describe el problema').fill('Quiero comprar una doble suspensión usada en Rivas.');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByRole('heading', { name: 'La bici a inspeccionar' })).toBeVisible();
  await page.locator('label', { hasText: 'Montaña (MTB)' }).click();
  await page.getByLabel('Marca').fill('Specialized');
  await page.getByLabel('Modelo').fill('Stumpjumper Comp');
  await page.getByLabel(/Precio que piden/).fill('1200');
  await page.getByLabel(/¿Dónde está la bici?/).fill('Rivas Urbanizaciones');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click(); // no photos

  await page.getByLabel('Zona', { exact: true }).selectOption('rivas');
  await page.locator('label', { hasText: 'A domicilio' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
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
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Specialized Stumpjumper Evo')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await expect(page.getByTestId('sent-title')).toHaveText('Solicitud enviada a Nerea');
  await page.getByRole('link', { name: 'Ver mi solicitud' }).click();
  await expect(statusTitle(page)).toHaveText('Solicitud enviada');
  await expect(page.getByText('Bici a inspeccionar')).toBeVisible();
  await expect(page.getByText('Precio pedido: 1200 €')).toBeVisible();
});
