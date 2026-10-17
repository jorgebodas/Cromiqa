import { expect, test } from '@playwright/test';
import { freshDemo, isMobile, switchAccount } from './helpers';

test.describe('Navegación', () => {
  test('owner routes render and deep links survive reloads', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const routes: [string, RegExp][] = [
      ['#/', /Tu bici, en buenas manos/],
      ['#/mecanicos', /Mecánicos para tu bici/],
      ['#/mecanicos/m-marta', /Marta Ibáñez/],
      ['#/solicitudes', /Hola, Ana/],
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

  test('primary navigation works', async ({ page }) => {
    await freshDemo(page, 'u-ana');
    const nav = page.getByRole('navigation', { name: isMobile(page) ? 'Principal (móvil)' : 'Principal', exact: true });
    await nav.getByRole('link', { name: isMobile(page) ? 'Garaje' : 'Mi garaje' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus bicis');
    await nav.getByRole('link', { name: isMobile(page) ? /Solicitudes/ : /Mis solicitudes/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola, Ana');
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
