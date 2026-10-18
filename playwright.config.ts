import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const LEADS_PORT = 4175;
const ADMIN_PORT = 4177;
// Fake Supabase project: every request to it is mocked in tests/e2e/fakeSupabase.ts.
const FAKE_SUPABASE = 'https://cromiqa-test.supabase.co';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    { name: 'desktop', testIgnore: /(leads|admin)\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', testIgnore: /(leads|admin)\.spec/, use: { ...devices['Pixel 7'] } },
    // Lead forms only render when an email is configured: test them on a separate build
    // with a placeholder address (all requests to FormSubmit are mocked).
    { name: 'leads', testMatch: /leads\.spec/, use: { ...devices['Pixel 7'], baseURL: `http://localhost:${LEADS_PORT}/` } },
    // Supabase-connected build: admin panel and database-backed forms (network mocked).
    { name: 'admin', testMatch: /admin\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, baseURL: `http://localhost:${ADMIN_PORT}/` } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: `npm run preview`, url: `http://localhost:${PORT}/`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
        {
          command: `VITE_LEAD_EMAIL=leads@example.invalid npx vite build --outDir dist-leads --emptyOutDir --logLevel warn && npx vite preview --outDir dist-leads --port ${LEADS_PORT} --strictPort`,
          url: `http://localhost:${LEADS_PORT}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `VITE_SUPABASE_URL=${FAKE_SUPABASE} VITE_SUPABASE_ANON_KEY=test-anon-key npx vite build --outDir dist-admin --emptyOutDir --logLevel warn && npx vite preview --outDir dist-admin --port ${ADMIN_PORT} --strictPort`,
          url: `http://localhost:${ADMIN_PORT}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
