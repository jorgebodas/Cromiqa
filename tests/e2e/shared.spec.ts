import { expect, test, type BrowserContext, type Route } from '@playwright/test';
import { FAKE_SUPABASE } from './fakeSupabase';

// Shared test world: two browser contexts are two phones, both talking to one fake Supabase
// (auth + the demo_world row with compare-and-swap), like the real setup.
const GATE = '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d';

function fakeWorld() {
  let row: { data: unknown; version: number } | null = null;
  const accounts = new Map<string, { password: string; meta: Record<string, unknown> }>([
    ['taller2@cromiqa.com', { password: 'secreta', meta: {} }],
  ]);
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const session = (email: string) => ({
    access_token: `${b64url({ alg: 'HS256' })}.${b64url({ sub: email, email, role: 'authenticated', aal: 'aal1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'r',
    user: { id: email, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: accounts.get(email)?.meta ?? {}, created_at: '' },
  });
  const json = (route: Route, status: number, body?: unknown) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

  return async (context: BrowserContext) => {
    await context.addInitScript((g) => localStorage.setItem('cromiqa:access', g), GATE);
    await context.route(`${FAKE_SUPABASE}/auth/v1/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/signup')) {
        const { email, password, data } = route.request().postDataJSON();
        accounts.set(email, { password, meta: data ?? {} });
        return json(route, 200, session(email));
      }
      if (url.pathname.endsWith('/token')) {
        const { email, password } = route.request().postDataJSON();
        if (accounts.get(email)?.password !== password) return json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
        return json(route, 200, session(email));
      }
      if (url.pathname.endsWith('/logout')) return json(route, 204);
      return json(route, 200, {});
    });
    await context.route(`${FAKE_SUPABASE}/rest/v1/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.endsWith('/rpc/demo_world_commit')) {
        const { p_expected, p_data } = req.postDataJSON();
        if (!row || row.version !== p_expected) return json(route, 400, { code: '40001', message: 'demo_world_conflict' });
        row = { data: p_data, version: p_expected + 1 };
        return json(route, 200, row.version);
      }
      if (url.pathname.endsWith('/demo_world')) {
        if (req.method() === 'POST') {
          row ??= { data: req.postDataJSON().data, version: 1 };
          return json(route, 201);
        }
        const objectWanted = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
        if (!row) return objectWanted ? json(route, 406, { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' }) : json(route, 200, []);
        return json(route, 200, objectWanted ? row : [row]);
      }
      return json(route, 200, []);
    });
  };
}

test('two phones: a cyclist signs up and sends a request; a test workshop signs in and answers; the cyclist sees the quote', async ({ browser }) => {
  const connect = fakeWorld();
  const friendCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const myCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await connect(friendCtx);
  await connect(myCtx);
  const friend = await friendCtx.newPage();
  const me = await myCtx.newPage();

  // Friend: creates an account (no demo account picker, no "Ver como").
  await friend.goto('./');
  await expect(friend.getByRole('heading', { name: 'Entra en Cromiqa' })).toBeVisible();
  await friend.getByRole('tab', { name: 'Crear cuenta' }).click();
  await friend.getByLabel('Tu nombre').fill('Amigo Prueba');
  await friend.getByLabel('Tu zona').selectOption('rivas');
  await friend.getByLabel('Email').fill('amigo@example.com');
  await friend.getByLabel('Contraseña').fill('secreta');
  await friend.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(friend.getByText('Prueba compartida')).toBeVisible();
  await expect(friend.getByTestId('demo-switch')).toHaveCount(0);

  // Sends a repair to Laura (taller2), from the Request Hub.
  await friend.getByTestId('new-request-fab').click();
  const hub = friend.getByTestId('request-hub');
  await hub.getByText('Reparación', { exact: true }).click();
  await hub.getByLabel('Describe el problema').fill('El freno delantero apenas frena.');
  await hub.getByRole('button', { name: 'Continuar' }).click();
  await hub.locator('label', { hasText: 'Montaña (MTB)' }).click();
  await hub.getByRole('button', { name: 'Continuar' }).click();
  await hub.getByRole('button', { name: 'Continuar' }).click(); // no photos
  await expect(hub.getByLabel('Zona', { exact: true })).toHaveValue('rivas'); // their own zone, prefilled
  await hub.locator('label', { hasText: 'A domicilio' }).click();
  await hub.getByRole('button', { name: 'Continuar' }).click();
  await hub.getByRole('button', { name: 'Continuar' }).click(); // any time
  await hub.getByTestId('provider-option').filter({ hasText: 'Laura Prieto' }).click();
  await hub.getByRole('button', { name: 'Continuar' }).click();
  await hub.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(friend.getByTestId('request-hub-chip')).toContainText('Esperando respuesta');

  // Me, on my phone: sign in as the test workshop and answer with a quote.
  await me.goto('./');
  await me.getByLabel('Email').fill('taller2@cromiqa.com');
  await me.getByLabel('Contraseña').fill('incorrecta');
  await me.getByRole('button', { name: 'Entrar' }).click();
  await expect(me.getByText('Email o contraseña incorrectos.')).toBeVisible();
  await me.getByLabel('Contraseña').fill('secreta');
  await me.getByRole('button', { name: 'Entrar' }).click();
  await expect(me.getByText('Prueba compartida')).toBeVisible();
  await me.goto('./#/pro/solicitudes');
  await me.getByTestId('request-card').filter({ hasText: 'Amigo' }).click();
  await expect(me.getByText('El freno delantero apenas frena.')).toBeVisible();
  await expect(me.getByRole('button', { name: /Ver como/ })).toHaveCount(0);
  await me.getByTestId('respond-options').getByRole('button', { name: 'Presupuesto cerrado' }).click();
  const form = me.getByTestId('proposal-form');
  await form.getByLabel('Precio total (€)').fill('30');
  await form.getByLabel('Mensaje para el cliente').fill('Purgo el freno en tu casa. Incluye líquido.');
  await form.getByRole('button', { name: 'Enviar presupuesto' }).click();
  await expect(me.getByTestId('request-status-title')).toHaveText('Presupuesto enviado');

  // Friend's phone picks it up.
  await friend.reload();
  await expect(friend.getByTestId('request-hub-chip')).toContainText('1 presupuesto');
  await friend.getByTestId('request-hub-chip').click();
  await expect(hub.getByTestId('quick-quote')).toContainText('30');

  // Signing out goes back to the sign-in screen.
  await friend.getByTestId('request-hub').getByRole('button', { name: 'Cerrar' }).click();
  await friend.getByTestId('sign-out').click();
  await expect(friend.getByRole('heading', { name: 'Entra en Cromiqa' })).toBeVisible();

  await friendCtx.close();
  await myCtx.close();
});
