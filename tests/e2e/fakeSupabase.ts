import type { Page, Route } from '@playwright/test';

export const FAKE_SUPABASE = 'https://cromiqa-test.supabase.co';

type Row = Record<string, unknown> & { id?: string };

/** In-memory stand-in for the Supabase REST, RPC, auth and storage endpoints the app uses. */
export async function fakeSupabase(page: Page, opts: { admin?: boolean; waitlist?: Row[]; mechanics?: Row[] } = {}) {
  const db: Record<string, Row[]> = {
    waitlist_leads: opts.waitlist ?? [],
    mechanic_leads: opts.mechanics ?? [],
    site_content: [],
  };
  const log: { method: string; path: string; body?: unknown }[] = [];
  const now = () => new Date().toISOString();
  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

  await page.route(`${FAKE_SUPABASE}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    log.push({ method: route.request().method(), path: url.pathname });
    if (url.pathname.endsWith('/token')) {
      const { email, password } = route.request().postDataJSON();
      if (password !== 'correcta') return json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: now() };
      return json(route, 200, { access_token: 'fake.jwt.token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user });
    }
    if (url.pathname.endsWith('/logout')) return json(route, 204);
    return json(route, 200, {});
  });

  await page.route(`${FAKE_SUPABASE}/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop()!;
    const body = req.postData() ? req.postDataJSON() : undefined;
    log.push({ method: req.method(), path: `${url.pathname}${url.search}`, body });
    if (url.pathname.includes('/rpc/is_admin')) return json(route, 200, opts.admin ?? true);
    const rows = (db[table] ??= []);
    const idEq = url.searchParams.get('id')?.replace(/^eq\./, '');
    switch (req.method()) {
      case 'GET':
        return json(route, 200, rows);
      case 'POST': {
        const items = (Array.isArray(body) ? body : [body]) as Row[];
        for (const it of items) {
          if (table === 'site_content') {
            const i = rows.findIndex((r) => r.key === it.key);
            if (i >= 0) rows[i] = { ...rows[i], ...it };
            else rows.push(it);
            continue;
          }
          if (rows.some((r) => String(r.email).toLowerCase() === String(it.email).toLowerCase()))
            return json(route, 409, { code: '23505', message: 'duplicate key value violates unique constraint', details: null, hint: null });
          rows.push({ id: `id-${rows.length + 1}`, created_at: now(), updated_at: now(), status: 'new', notes: '', ...it });
        }
        return json(route, 201);
      }
      case 'PATCH': {
        const r = rows.find((x) => x.id === idEq);
        if (r) Object.assign(r, body);
        return json(route, 204);
      }
      case 'DELETE':
        db[table] = rows.filter((x) => x.id !== idEq);
        return json(route, 204);
    }
    return json(route, 405);
  });

  await page.route(`${FAKE_SUPABASE}/storage/v1/**`, (route) => json(route, 200, { Key: 'site/carousel/x.jpg' }));
  return { db, log };
}
