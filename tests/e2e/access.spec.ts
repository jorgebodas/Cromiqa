import { expect, test } from '@playwright/test';

// The password is never in the repo; tests use a wrong one and the stored hash.
const HASH = 'a4c7c39e9911444f184e4b3cbb271dfc46954288f89badfa62474431144684b3';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('visitors only see the coming-soon page', async ({ page }) => {
  await page.goto('./#/mecanicos');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Cromiqa' })).toBeVisible();
  await expect(page.getByText('Encuentra mecánicos de confianza para reparar, mantener o revisar tu bici, donde y cuando te venga mejor.')).toBeVisible();
  await expect(page.getByText('Próximamente', { exact: true })).toBeVisible();
  const benefits = page.getByTestId('benefits');
  await expect(benefits.getByRole('heading', { level: 2, includeHidden: true })).toHaveCount(5);
  // The deck shows one benefit at a time; tapping it brings the next headline in.
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText('Empieza por el problema');
  await benefits.getByRole('img').first().click({ force: true });
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText('Precios claros');
  // Dragging the photo sideways moves between benefits too.
  const box = (await benefits.locator('img').first().boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, y, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.1, y, { steps: 5 });
  await page.mouse.up();
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText('Donde tú prefieras');
  await benefits.getByRole('button', { name: 'Revisión antes de comprar' }).click();
  await expect(benefits.getByRole('heading', { level: 2 })).toHaveText('Revisión antes de comprar');
  await expect(page.getByTestId('benefits').locator('img')).toHaveCount(5);
  await expect(page.getByText('Entorno de demostración')).toHaveCount(0);
  await expect(page.getByText('Mecánicos para tu bici')).toHaveCount(0);
});

test('hidden top-right corner opens the login; wrong password is rejected', async ({ page }) => {
  await page.reload();
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width - 10, 10);
  const dialog = page.getByRole('dialog', { name: 'Acceso privado' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Contraseña').fill('no-es-esta');
  await dialog.getByRole('button', { name: 'Entrar' }).click();
  await expect(dialog.getByText('Contraseña incorrecta.')).toBeVisible();
});

test('secret link opens the login directly', async ({ page }) => {
  await page.goto('./#/entrar');
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Acceso privado' })).toBeVisible();
});

test('a remembered device goes straight into the prototype', async ({ page }) => {
  await page.evaluate((h) => localStorage.setItem('cromiqa:access', h), HASH);
  await page.goto('./#/mecanicos');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mecánicos para tu bici');
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
