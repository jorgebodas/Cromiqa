import { expect, test } from '@playwright/test';

// The password is never in the repo; tests use a wrong one and the stored hash.
const HASH = '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('visitors only see the coming-soon page', async ({ page }) => {
  await page.goto('./#/mecanicos');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Cromiqa' })).toBeVisible();
  await expect(page.getByText('Encuentra mecánicos de confianza para reparar, mantener o revisar tu bici, donde y cuando te venga mejor.')).toHaveCount(1);
  await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
  const benefits = page.getByTestId('benefits');
  await expect(benefits.getByRole('heading', { level: 2, includeHidden: true })).toHaveCount(5);
  // The deck shows one benefit at a time; tapping it brings the next headline in.
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText(/^Dinos qué le pasa a tu bici y te ayudamos/);
  await benefits.getByRole('img').first().click({ force: true });
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText(/^Precios claros antes de pedir nada/);
  // Dragging the photo sideways moves between benefits too.
  const box = (await benefits.locator('img').first().boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, y, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.1, y, { steps: 5 });
  await page.mouse.up();
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText(/^A domicilio o en el taller, tú eliges/);
  await expect(page.getByTestId('benefits').locator('img')).toHaveCount(5);
  await expect(page.getByText('Entorno de demostración')).toHaveCount(0);
  await expect(page.getByText('Mecánicos para tu bici')).toHaveCount(0);
});

test('the round button in the waitlist card swaps it to tester access; wrong password is rejected; back returns', async ({ page }) => {
  await page.reload();
  // The old hidden corner entrance is gone.
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width - 10, 10);
  await expect(page.getByTestId('tester-form')).toHaveCount(0);

  await page.getByRole('button', { name: 'Avísame' }).click();
  await page.getByTestId('tester-login').click();
  // Same dock card, no dialog: the form swaps in place and the lime button becomes "Entrar".
  const form = page.getByTestId('tester-form');
  await expect(form.getByRole('heading', { name: 'Probar el prototipo' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await form.getByLabel('Contraseña').fill('no-es-esta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(form.getByText('Contraseña incorrecta.')).toBeVisible();

  await page.getByTestId('tester-back').click();
  await expect(page.getByTestId('waitlist-form')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
});

test('direct link opens tester access in the dock', async ({ page }) => {
  await page.goto('./#/entrar');
  await page.reload();
  await expect(page.getByTestId('tester-form')).toBeVisible();
});

test('a remembered device goes straight into the prototype', async ({ page }) => {
  await page.evaluate((h) => localStorage.setItem('cromiqa:access', h), HASH);
  await page.goto('./#/mecanicos');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mecánicos');
});

test('floating dock shows both calls to action on one line', async ({ page }) => {
  await page.reload();
  const a = await page.getByRole('button', { name: 'Avísame' }).boundingBox();
  const b = await page.getByRole('button', { name: 'Soy mecánico' }).boundingBox();
  expect(a && b && Math.abs(a.y - b.y) < 2).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('share card and SEO tags are present', async ({ page, request }) => {
  await page.reload();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://cromiqa.com/og-image.png');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  expect((await request.get('./og-image.png')).headers()['content-type']).toContain('image/png');
  expect(await (await request.get('./robots.txt')).text()).toContain('Sitemap: https://cromiqa.com/sitemap.xml');
});
