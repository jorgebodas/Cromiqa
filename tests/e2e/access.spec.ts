import { expect, test } from '@playwright/test';

// The password is not stored in the repo; tests only need a wrong one and the stored hash.
const HASH = 'f3e8217e50e7dab64ebd5b8438a2eaec49498479bdaf690fa665ea5d779a1783';

test('private gate blocks the app until unlocked', async ({ page }) => {
  await page.goto('./#/mecanicos');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acceso privado' })).toBeVisible();
  await expect(page.getByText('Mecánicos para tu bici')).toHaveCount(0);

  await page.getByLabel('Contraseña').fill('no-es-esta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Contraseña incorrecta.')).toBeVisible();

  // A remembered device (stored hash) goes straight in, keeping the deep link.
  await page.evaluate((h) => localStorage.setItem('cromiqa:access', h), HASH);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mecánicos para tu bici');
});
