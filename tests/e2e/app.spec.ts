import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, switchAccount } from './helpers';

test.describe('Navegación', () => {
  test('owner routes render and deep links survive reloads', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const routes: [string, RegExp][] = [
      ['#/', /Tu bici, en buenas manos/],
      ['#/mecanicos', /Mecánicos para tu bici/],
      ['#/mecanicos/m-marta', /Marta Ibáñez/],
      ['#/actividad', /Actividad/],
      ['#/solicitudes', /Actividad/], // old link redirects
      ['#/garaje', /Tus bicis/],
      ['#/garaje/b-ana-mtb', /La de monte/],
      ['#/cuenta', /Tu cuenta/],
      ['#/demo', /Panel de demostración/],
      ['#/no-existe', /Esta página no existe/],
    ];
    for (const [hash, heading] of routes) {
      await page.goto('./' + hash);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
  });

  test('mechanic routes render', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    for (const [hash, heading] of [
      ['#/pro', /Hola, Carlos/],
      ['#/pro/solicitudes', /Solicitudes de clientes/],
      ['#/pro/servicios', /Servicios y precios/],
      ['#/pro/disponibilidad', /Tu disponibilidad/],
      ['#/pro/perfil', /Ortega Trail Lab/],
    ] as const) {
      await page.goto('./' + hash);
      await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(heading);
    }
  });

  test('cyclist navigation: three destinations, account, search and activity', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const mobile = isMobile(page);
    const nav = page.getByRole('navigation', { name: mobile ? 'Principal (móvil)' : 'Principal', exact: true });
    await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Mecánicos', 'Garaje']);
    await nav.getByRole('link', { name: 'Garaje' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus bicis');
    await expect(nav.getByRole('link', { name: 'Garaje' })).toHaveAttribute('aria-current', 'page');

    // Avatar → the existing account screen.
    await page.getByTestId('account-link').filter({ visible: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu cuenta');

    // Search → quick results from the demo data.
    if (mobile) await page.getByTestId('search-bar').click();
    else await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    const search = page.getByRole('dialog', { name: 'Buscar' });
    await search.getByRole('searchbox').fill('frenos');
    await expect(search.getByRole('button', { name: 'Frenos' })).toBeVisible();
    await search.getByRole('button', { name: /Nerea Campos/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nerea Campos');

    // Bell → Actividad, with every request listed.
    await page.getByTestId('activity-link').filter({ visible: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actividad');
    await page.getByRole('tab', { name: /Todas/ }).click();
    await expect(page.getByTestId('request-card').first()).toBeVisible();
  });

  test('activity badge counts unread updates and clears once seen', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const bell = page.getByTestId('activity-link').filter({ visible: true });
    await expect(bell).toHaveAttribute('aria-label', /sin leer/);
    await bell.click();
    await page.getByRole('tab', { name: /Novedades/ }).click();
    await expect(page.getByTestId('updates').getByRole('link').first()).toBeVisible();
    await expect(bell).toHaveAttribute('aria-label', 'Actividad');
    await page.reload();
    await expect(page.getByTestId('activity-link').filter({ visible: true })).toHaveAttribute('aria-label', 'Actividad');
  });

  test('new request: + opens the four needs and starts the existing flow', async ({ page }) => {
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
    await sheet.getByRole('button', { name: 'Mantenimiento' }).click();
    await expect(page).toHaveURL(/#\/mecanicos\?servicio=maintenance/);
    await expect(page.getByText('Tu necesidad: Mantenimiento')).toBeVisible();

    await page.getByRole('link', { name: /^Solicitar servicio/ }).first().click();
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
    await nav.getByRole('link', { name: 'Garaje' }).click();
    await nav.getByRole('link', { name: 'Mecánicos' }).click();
    await expect(page.getByRole('searchbox', { name: /Buscar/ })).toHaveValue('suspensión');

    await page.goto('./#/garaje/b-ana-mtb');
    await page.reload();
    await page.getByRole('link', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus bicis');
  });

  test('phones: scrolling condenses the bars into circles that still work', async ({ page }) => {
    test.skip(!isMobile(page), 'Phone-only behaviour');
    await freshDemo(page, 'u-ana');
    await page.goto('./#/mecanicos');
    await page.mouse.wheel(0, 700);
    const condensed = page.getByTestId('nav-condensed');
    await expect(condensed).toBeVisible();
    await expect(condensed).toHaveAccessibleName(/Mecánicos/);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(60); // one circle
    // Header circles stay usable: search opens straight away.
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Tapping the circle brings the full bar back.
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await condensed.boundingBox())?.width).toBeLessThanOrEqual(60);
    await condensed.click();
    await expect(page.getByRole('navigation', { name: 'Principal (móvil)' }).getByRole('link', { name: 'Garaje' })).toBeVisible();
  });

  test('mechanics keep their own navigation', async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/pro');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await expect(nav.getByRole('link')).toHaveCount(5);
    await expect(page.getByTestId('new-request-fab')).toHaveCount(0);
  });

  test('role gates offer a demo account instead of a fake login', async ({ page }) => {
    await freshDemo(page);
    await page.goto('./#/garaje');
    await expect(page.getByText('Entra con una cuenta de demostración')).toBeVisible();
    await page.getByRole('button', { name: /Continuar como Ana/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus bicis');
  });
});

test.describe('Validación de formularios', () => {
  test('home search requires a service type', async ({ page }) => {
    await freshDemo(page);
    await page.getByRole('button', { name: 'Buscar mecánicos' }).click();
    await expect(page.getByText('Elige qué necesita tu bici para continuar.')).toBeVisible();
    await expect(page).not.toHaveURL(/mecanicos/);
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
    const form = page.getByTestId('proposal-form');
    await form.getByLabel('Precio total (€)').fill('0');
    await form.getByRole('button', { name: 'Enviar propuesta' }).click();
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
    await expect(page.getByTestId('demo-requests-table').locator('tbody tr')).toHaveCount(12);
    await page.getByTestId('reset-demo').click();
    await page.getByTestId('confirm-reset').click();
    await expect(page.getByTestId('demo-switch')).toContainText('Invitado');
    await switchAccount(page, 'Ana López');
    await page.goto('./#/garaje');
    await expect(page.getByTestId('bike-card')).toHaveCount(2);
  });
});
