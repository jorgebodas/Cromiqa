import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { freshDemo } from './helpers';

// Automated accessibility checks (WCAG 2 A/AA rules axe can verify) on the main screens of
// both modes. Not a substitute for manual testing with a screen reader.
async function expectNoViolations(page: Page) {
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')}`);
  expect(summary).toEqual([]);
}

const CYCLIST = ['/', '/mecanicos', '/mecanicos/m-carlos', '/solicitudes', '/solicitudes/r-01', '/solicitudes/r-14/mecanico/r-14', '/solicitar', '/cuenta', '/garaje', '/actividad', '/pro/alta'];
const MECHANIC = ['/pro', '/pro/solicitudes', '/pro/solicitudes/r-01', '/pro/trabajos', '/pro/perfil', '/pro/servicios', '/pro/disponibilidad'];

for (const path of CYCLIST) {
  test(`a11y cyclist ${path}`, async ({ page }) => {
    await freshDemo(page, 'u-ana');
    await page.goto(`./#${path}`);
    await expectNoViolations(page);
  });
}

for (const path of MECHANIC) {
  test(`a11y mechanic ${path}`, async ({ page }) => {
    await freshDemo(page, 'u-carlos');
    await page.goto('./#/cuenta');
    await page.goto(`./#${path}`);
    await expectNoViolations(page);
  });
}

test('a11y new request box', async ({ page }) => {
  await freshDemo(page, 'u-pablo');
  await page.goto('./#/solicitudes');
  await page.getByTestId('requests-new').click();
  await expect(page.getByTestId('request-hub').getByText('Paso 1 de 7')).toBeVisible();
  await expectNoViolations(page);
});
