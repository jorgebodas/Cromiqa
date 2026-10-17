import { expect, type Page } from '@playwright/test';

/** Start from a clean demo (seed data, guest session). */
export async function freshDemo(page: Page, userId: string | null = null) {
  await page.goto('./');
  await page.evaluate((u) => {
    localStorage.clear();
    // Skip the private-preview gate (tested separately in access.spec.ts).
    localStorage.setItem('cromiqa:access', 'f3e8217e50e7dab64ebd5b8438a2eaec49498479bdaf690fa665ea5d779a1783');
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
