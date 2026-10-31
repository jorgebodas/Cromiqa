import { expect, type Page } from '@playwright/test';

/** Start from a clean demo (seed data, guest session). */
export async function freshDemo(page: Page, userId: string | null = null) {
  await page.goto('./');
  await page.evaluate((u) => {
    localStorage.clear();
    // Skip the private-preview gate (tested separately in access.spec.ts).
    localStorage.setItem('cromiqa:access', '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d');
    if (u) localStorage.setItem('cromiqa:demo:session', JSON.stringify({ userId: u }));
  }, userId);
  await page.reload();
  await expect(page.getByText('Entorno de demostración').first()).toBeVisible();
}

export function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1000) < 768;
}

/** Switch demo account through the banner switcher (the real UI path). */
export async function switchAccount(page: Page, name: string) {
  await page.getByTestId('demo-switch').click();
  const dialog = page.getByRole('dialog', { name: 'Cambiar de cuenta' });
  await dialog.getByRole('button', { name: new RegExp(name) }).click();
  await expect(dialog).toBeHidden();
}

export const statusTitle = (page: Page) => page.getByTestId('request-status-title');
