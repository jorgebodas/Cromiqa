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

test('waitlist opens from the dock, validates, submits and confirms', async ({ page }) => {
  const bodies: Record<string, string>[] = [];
  await page.route('https://formsubmit.co/ajax/**', ok(bodies));
  const cta = page.getByRole('button', { name: 'Avísame' });
  await expect(cta).toHaveAttribute('aria-expanded', 'false');
  await cta.click();
  await expect(page.getByRole('button', { name: 'Cerrar' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Soy mecánico' })).toBeHidden();
  const form = page.getByTestId('waitlist-form');
  await expect(form.getByLabel('Tu email')).toBeFocused();
  await expect(form.getByText('Escribe un email válido.')).toHaveCount(0); // opening doesn't submit

  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(form.getByText('Escribe un email válido.')).toBeVisible();
  expect(bodies).toHaveLength(0);

  await form.getByLabel('Tu email').fill('ciclista@example.com');
  await form.getByLabel('Tu zona').selectOption('rivas');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('¡Estás dentro!')).toBeVisible();
  expect(bodies[0]).toMatchObject({ email: 'ciclista@example.com', zona: 'Rivas-Vaciamadrid', tipo: 'Lista de espera', _honey: '' });
  await page.getByRole('button', { name: 'Listo' }).click();

  // The form stays available (no "already signed up" lock), even after a reload…
  await page.reload();
  await page.getByRole('button', { name: 'Avísame' }).click();
  await expect(page.getByLabel('Tu email')).toHaveValue('');

  // …but the same email is rejected without sending anything.
  await page.getByLabel('Tu email').fill('CICLISTA@example.com ');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Este email ya está en la lista de espera.')).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test('waitlist shows an error when the service fails', async ({ page }) => {
  await page.route('https://formsubmit.co/ajax/**', (route) => route.fulfill({ status: 500, json: { success: 'false' } }));
  await page.getByRole('button', { name: 'Avísame' }).click();
  const form = page.getByTestId('waitlist-form');
  await form.getByLabel('Tu email').fill('ciclista@example.com');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(form.getByText('No hemos podido enviarlo.')).toBeVisible();
});

test('dock morphs in place: "Avísame" becomes "Confirmar" and "Soy mecánico" becomes close', async ({ page }) => {
  const start = (await page.getByRole('button', { name: 'Avísame' }).boundingBox())!;
  await page.getByRole('button', { name: 'Avísame' }).click();
  await expect(page.getByTestId('waitlist-form')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Soy mecánico' })).toBeVisible();

  await page.getByRole('button', { name: 'Soy mecánico' }).click();
  await expect(page.getByTestId('mechanic-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avísame' })).toHaveCount(0);
  await page.waitForTimeout(700); // let the spring settle
  const close = (await page.getByRole('button', { name: 'Cerrar' }).boundingBox())!;
  const confirm = (await page.getByRole('button', { name: 'Confirmar' }).boundingBox())!;
  expect(close.x).toBeGreaterThan(confirm.x); // close on the right
  expect(close.width).toBeLessThan(64); // round
  expect(Math.abs(confirm.y - start.y)).toBeLessThan(12); // same row (it only gains the card's bottom padding)
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Avísame' })).toBeVisible();
});

test('mechanic form validates and submits', async ({ page }) => {
  const bodies: Record<string, string>[] = [];
  await page.route('https://formsubmit.co/ajax/**', ok(bodies));
  await page.getByRole('button', { name: 'Soy mecánico' }).click();
  const form = page.getByTestId('mechanic-form');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(form.getByText('Escribe tu nombre.')).toBeVisible();
  await expect(form.getByText('Elige tu zona principal.')).toBeVisible();

  await form.getByLabel('Nombre').fill('Rosa Gil');
  await form.getByLabel('Taller (opcional)').fill('Taller Rosa');
  await form.getByLabel('Email').fill('rosa@example.com');
  await form.getByLabel('Zona principal').selectOption('arganda');
  await form.getByLabel('Especialidad (opcional)').fill('MTB y eléctricas');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('¡Gracias!')).toBeVisible();
  expect(bodies[0]).toMatchObject({ nombre: 'Rosa Gil', taller: 'Taller Rosa', zona: 'Arganda del Rey', tipo: 'Mecánico', telefono: '—' });

  // Register a second workshop right away.
  await page.getByRole('button', { name: 'Listo' }).click();
  await page.getByRole('button', { name: 'Soy mecánico' }).click();
  const again = page.getByTestId('mechanic-form');
  await again.getByLabel('Nombre').fill('Luis Pardo');
  await again.getByLabel('Zona principal').selectOption('coslada');
  await again.getByLabel('Email').fill('rosa@example.com');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(again.getByText('Este email ya está registrado como mecánico.')).toBeVisible();
  await again.getByLabel('Email').fill('luis@example.com');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('¡Gracias!')).toBeVisible();
  expect(bodies.map((b) => b.email)).toEqual(['rosa@example.com', 'luis@example.com']);
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

test('on-screen keyboard: fields are 16px (no iOS zoom) and the buttons stay above the keyboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Soy mecánico' }).click();
  const name = page.getByTestId('mechanic-form').getByLabel('Nombre');
  await expect(name).toBeFocused();
  expect(await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);

  // Simulate a 320px keyboard the way iOS reports it: the visual viewport shrinks.
  const keyboardTop = await page.evaluate(() => {
    const vv = window.visualViewport!;
    const height = window.innerHeight - 320;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => height });
    vv.dispatchEvent(new Event('resize'));
    return height;
  });
  await page.waitForTimeout(400);
  for (const label of ['Confirmar', 'Cerrar']) {
    const box = (await page.getByRole('button', { name: label }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(keyboardTop);
  }
});
