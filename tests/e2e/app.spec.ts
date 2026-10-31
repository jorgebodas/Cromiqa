import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, switchAccount } from './helpers';

test.describe('Navegación', () => {
  test('cyclist routes render and deep links survive reloads', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const routes: [string, RegExp][] = [
      ['#/', /^Inicio$/],
      ['#/mecanicos', /^Mecánicos$/],
      ['#/mecanicos/m-marta', /Marta Ibáñez/],
      ['#/solicitudes', /^Solicitudes$/],
      ['#/actividad', /^Notificaciones$/],
      ['#/garaje', /^Garaje$/],
      ['#/garaje/b-ana-mtb', /La de monte/],
      ['#/cuenta', /^Perfil$/],
      ['#/demo', /^Demo$/],
      ['#/no-existe', /Esta página no existe/],
    ];
    for (const [hash, heading] of routes) {
      await page.goto('./' + hash);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
  });

  test('mechanic routes render, and old list links still land on the right segment', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    for (const [hash, heading] of [
      ['#/pro', /^Inicio$/],
      ['#/pro/solicitudes', /^Solicitudes$/],
      ['#/pro/trabajos', /^Servicios$/],
      ['#/pro/servicios', /^Tarifas$/],
      ['#/pro/disponibilidad', /^Disponibilidad$/],
      ['#/pro/perfil', /^Perfil profesional$/],
    ] as const) {
      await page.goto('./' + hash);
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
    await page.goto('./#/pro/solicitudes?estado=agenda');
    await expect(page).toHaveURL(/#\/pro\/trabajos\?estado=proximos/);
    await expect(page.getByRole('tab', { name: /Con cita/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('cyclist: Inicio · Mecánicos · Solicitudes, a separate +, avatar left, search and bell right', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const mobile = isMobile(page);
    const nav = page.getByRole('navigation', { name: mobile ? 'Principal (móvil)' : 'Principal', exact: true });
    await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Mecánicos', 'Solicitudes']);
    await expect(mobile ? page.getByTestId('new-request-fab') : page.getByRole('button', { name: 'Nueva solicitud' })).toBeVisible();

    await nav.getByRole('link', { name: 'Solicitudes' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitudes');
    await page.getByRole('tab', { name: /Todas/ }).click();
    await expect(page.getByTestId('case-card').first()).toBeVisible();
    await page.getByTestId('case-card').first().click();
    await expect(nav.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('aria-current', 'page');

    // Search is a global action on the main screens.
    await page.goto('./#/');
    await page.getByRole('button', { name: 'Buscar', exact: true }).filter({ visible: true }).click();
    const search = page.getByRole('dialog', { name: 'Buscar' });
    await search.getByRole('searchbox').fill('frenos');
    await search.getByRole('button', { name: /Nerea Campos/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nerea Campos');

    // Garage is secondary: not in the bar, reached from the profile.
    await expect(nav.getByRole('link', { name: 'Garaje' })).toHaveCount(0);
    await page.goto('./#/');
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perfil');
    await page.getByRole('link', { name: /^Garaje/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });

  test('notifications badge counts unread updates and clears once seen', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const bell = page.getByTestId('activity-link').filter({ visible: true });
    await expect(bell).toHaveAttribute('aria-label', /sin leer/);
    await bell.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notificaciones');
    await expect(page.getByTestId('updates').getByRole('link').first()).toBeVisible();
    await page.goto('./#/');
    await expect(bell).toHaveAttribute('aria-label', 'Notificaciones');
    await page.reload();
    await expect(page.getByTestId('activity-link').filter({ visible: true })).toHaveAttribute('aria-label', 'Notificaciones');
  });

  test('mechanic: Inicio · Solicitudes · Servicios, without +', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await expect(nav.getByRole('link')).toHaveText([/^Inicio/, /^Solicitudes/, /^Servicios/]);
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nueva solicitud' })).toHaveCount(0);
  });

  test('role switch from the profile, each mode returning to where it was', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    // Carlos has a professional profile: he starts in mechanic mode.
    await page.goto('./#/pro/trabajos');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Servicios');
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    // Cyclist mode, new to it: the Home invites to a first request, with no fake activity.
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByText('Te ayudamos a encontrar al mecánico adecuado.')).toBeVisible();
    await expect(page.getByTestId('attention')).toHaveCount(0);
    await expect(page.getByTestId('discover')).not.toContainText('Carlos Ortega'); // never his own workshop
    await page.goto('./#/mecanicos');
    // Back to mechanic mode: the last mechanic place, not the start.
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Mecánico' }).click();
    await expect(page).toHaveURL(/#\/pro\/trabajos$/);
    // …and cyclist mode remembers Mecánicos.
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await page.getByRole('radio', { name: 'Ciclista' }).click();
    await expect(page).toHaveURL(/#\/mecanicos$/);
    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mecánicos');
  });

  test('cyclist-only accounts have no mechanic mode, and mechanic screens explain it', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/cuenta');
    await expect(page.getByRole('radio', { name: 'Mecánico' })).toHaveCount(0);
    await expect(page.getByTestId('mode-card')).toContainText('El modo mecánico se activa al crear un perfil profesional');
    await page.goto('./#/pro');
    await expect(page.getByText('Tu cuenta aún no tiene perfil profesional.')).toBeVisible();
  });

  test('new request: + opens the four needs and starts the request flow', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const mobile = isMobile(page);
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).click();
    const sheet = page.getByRole('dialog', { name: '¿Qué necesita tu bici?' });
    await expect(sheet.getByRole('list', { name: 'Tipo de servicio' }).getByRole('button')).toHaveText([
      'Reparación',
      'Mantenimiento',
      'Inspección antes de comprar',
      'No sé qué le pasa',
    ]);
    // Request first: the need opens the flow; mechanics are chosen in step 4.
    await sheet.getByRole('button', { name: 'Mantenimiento' }).click();
    await expect(page).toHaveURL(/#\/solicitar/);
    await expect(page.getByRole('radio', { name: /Mantenimiento/ })).toBeChecked();
    // Focused flow: no tab bar and no + while filling it in.
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Principal (móvil)' })).toHaveCount(0);

    // Leaving keeps the draft, and + offers to continue it.
    await page.getByRole('textbox').first().fill('Revisión completa antes del verano.');
    await page.getByRole('button', { name: 'Salir de la solicitud' }).click();
    if (mobile) await page.getByTestId('new-request-fab').click();
    else await page.getByRole('button', { name: 'Nueva solicitud' }).click();
    await page.getByRole('button', { name: /Continuar la solicitud en curso/ }).click();
    await expect(page.getByRole('textbox').first()).toHaveValue('Revisión completa antes del verano.');
  });

  test('tabs remember their state, and back works from a direct link', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await page.getByRole('searchbox', { name: /Buscar/ }).fill('suspensión');
    await expect(page).toHaveURL(/q=suspensi/);
    await nav.getByRole('link', { name: 'Solicitudes' }).click();
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await expect(page.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('suspensión');

    await page.goto('./#/garaje/b-ana-mtb');
    await page.reload();
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });

  test('phones: scrolling shrinks the title into the pinned bar and the tabs into a circle', async ({ page }) => {
    test.skip(!isMobile(page), 'Phone-only behaviour');
    await freshDemo(page, 'u-ana');
    await page.goto('./#/mecanicos');
    await page.mouse.wheel(0, 700);
    const condensed = page.getByTestId('nav-condensed');
    await expect(condensed).toBeVisible();
    await expect(condensed).toHaveAccessibleName(/Mecánicos/);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(68); // one circle
    // The large title has shrunk into the pinned bar, which keeps its buttons.
    await expect(page.getByTestId('screen-bar')).toContainText('Mecánicos');
    await expect(page.getByTestId('activity-link').filter({ visible: true })).toBeVisible();
    // Tapping the circle brings the full bar back.
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(68);
    await condensed.click();
    await expect(page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Solicitudes' })).toBeVisible();
  });

  test('role gates offer a demo account instead of a fake login', async ({ page }) => {
    await freshDemo(page);
    await page.goto('./#/garaje');
    await expect(page.getByText('Entra con una cuenta de demostración')).toBeVisible();
    await page.getByRole('button', { name: /Continuar como Ana/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Garaje');
  });
});

test.describe('Validación de formularios', () => {
  test('cyclist home puts what needs you first, then a short summary and grounded suggestions', async ({ page }) => {
    await freshDemo(page, 'u-pablo');
    await expect(page.getByTestId('widget-need')).toBeVisible();
    const proposal = page.getByTestId('attention-proposal');
    // Pablo has two quotes for the same request: one card to compare them.
    await expect(proposal).toContainText('2 presupuestos para comparar');
    await expect(page.getByTestId('discover').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('discover')).not.toContainText('★');
    await proposal.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solicitud');
    await expect(page.getByTestId('case-status')).toHaveText('Propuestas recibidas');
  });

  test('mechanic home: to-do by urgency, counts open filtered lists, profile status', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro');
    await expect(page.getByTestId('todo-respond').first()).toContainText('Responder');
    await expect(page.getByTestId('profile-status')).toBeVisible();
    await page.getByTestId('count-unanswered').click();
    await expect(page).toHaveURL(/estado=sin-responder/);
    await expect(page.getByRole('tab', { name: /Sin responder/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('request flow blocks invalid steps', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/solicitar?mecanico=m-andres');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Elige el tipo de servicio.')).toBeVisible();
    await expect(page.getByText('Describe el problema con al menos 10 caracteres.')).toBeVisible();
    // Andrés offers no home service: the option is disabled
    await page.getByText('Reparación', { exact: true }).click();
    await page.getByLabel('Describe el problema').fill('Pinchazo en la rueda trasera.');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.locator('label', { hasText: 'Otra bici' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Indica la marca.')).toBeVisible();
    await page.locator('label').filter({ hasText: /^Urbana$/ }).click();
    await page.getByLabel('Marca').fill('Gazelle');
    await page.getByLabel('Modelo').fill('Esprit');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('radio', { name: /A domicilio/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Elige al menos una franja')).toBeVisible();
  });

  test('proposal form rejects a zero price', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro/solicitudes/r-02');
    await page.getByTestId('respond-options').getByRole('button', { name: 'Presupuesto cerrado' }).click();
    const form = page.getByTestId('proposal-form');
    await form.getByLabel('Precio total (€)').fill('0');
    await form.getByRole('button', { name: 'Enviar presupuesto' }).click();
    await expect(form.getByText('Indica un precio mayor que 0 €.')).toBeVisible();
  });

  test('garage bike form validates and saves', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/garaje');
    await page.getByRole('button', { name: 'Añadir bici' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Añadir bici' });
    await dialog.getByRole('button', { name: 'Añadir al garaje' }).click();
    await expect(dialog.getByText('Ponle un nombre a tu bici.')).toBeVisible();
    await dialog.getByLabel('Nombre').fill('La de gravel');
    await dialog.getByLabel('Marca').fill('Orbea');
    await dialog.getByLabel('Modelo').fill('Terra H40');
    await dialog.getByLabel('Tipo').selectOption('gravel');
    await dialog.getByRole('button', { name: 'Añadir al garaje' }).click();
    await expect(page.getByTestId('bike-card')).toHaveCount(3);
    await page.reload();
    await expect(page.getByTestId('bike-card').filter({ hasText: 'La de gravel' })).toBeVisible();
  });
});

test.describe('Persistencia y modo demo', () => {
  test('mechanic profile edits show up publicly and survive reload', async ({ page }) => {
    await freshDemo(page, 'u-marta');
    await page.goto('./#/pro/perfil');
    await page.getByLabel('Especialidad principal').fill('Carretera, gravel y ruedas a mano');
    await page.getByRole('button', { name: 'Suspensiones' }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Cambios guardados').first()).toBeVisible();

    await page.goto('./#/pro/servicios');
    await page.getByLabel('Nombre del servicio').first().fill('Puesta a punto premium');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Cambios guardados').first()).toBeVisible();

    await page.reload();
    await switchAccount(page, 'Invitado');
    await page.goto('./#/mecanicos/m-marta');
    await expect(page.getByText('Carretera, gravel y ruedas a mano').first()).toBeVisible();
    await expect(page.getByText('Puesta a punto premium')).toBeVisible();
    await page.goto('./#/mecanicos?especialidad=suspension');
    await expect(page.getByTestId('mechanic-card').filter({ hasText: 'Marta Ibáñez' })).toBeVisible();
  });

  test('current account persists across reloads and reset restores scenarios', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto('./#/garaje/b-ana-urban');
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: 'Eliminar bici' }).click();
    await expect(page.getByTestId('bike-card')).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId('bike-card')).toHaveCount(1);
    await expect(page.getByTestId('demo-switch')).toContainText('Ana');

    await page.goto('./#/demo');
    await expect(page.getByTestId('demo-requests-table').locator('tbody tr')).toHaveCount(13);
    await page.getByTestId('reset-demo').click();
    await page.getByTestId('confirm-reset').click();
    await expect(page.getByTestId('demo-switch')).toContainText('Invitado');
    await switchAccount(page, 'Ana López');
    await page.goto('./#/garaje');
    await expect(page.getByTestId('bike-card')).toHaveCount(2);
  });
});
