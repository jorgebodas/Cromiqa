import type { Page, Route } from '@playwright/test';

export const FAKE_SUPABASE = 'https://cromiqa-test.supabase.co';

type Row = Record<string, unknown> & { id?: string | number };

export const VALID_TOTP = '123456';

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** Unsigned JWT good enough for the client, which only decodes the payload (aal). */
const jwt = (aal: 'aal1' | 'aal2', email: string) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'u1', email, aal, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const aalOf = (authHeader?: string) => {
  try {
    return JSON.parse(Buffer.from((authHeader ?? '').split('.')[1] ?? '', 'base64url').toString()).aal as string;
  } catch {
    return undefined;
  }
};

/**
 * In-memory stand-in for the Supabase auth (incl. TOTP MFA), REST, RPC and storage endpoints the
 * app uses. Like the real database, admin rights require an aal2 (two-factor) session, and
 * admin changes are written to admin_activity.
 */
export async function fakeSupabase(
  page: Page,
  opts: { admin?: boolean; mfaEnrolled?: boolean; waitlist?: Row[]; mechanics?: Row[] } = {},
) {
  const db: Record<string, Row[]> = {
    waitlist_leads: opts.waitlist ?? [],
    mechanic_leads: opts.mechanics ?? [],
    site_content: [],
    admin_activity: [],
  };
  const auth = { email: 'admin@cromiqa.com', enrolled: opts.mfaEnrolled ?? true };
  const factor = () => ({ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Cromiqa', created_at: '', updated_at: '' });
  const user = () => ({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: auth.email, app_metadata: {}, user_metadata: {}, created_at: '', factors: auth.enrolled ? [factor()] : [] });
  const session = (aal: 'aal1' | 'aal2') => ({ access_token: jwt(aal, auth.email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: user() });
  let activityId = 1;
  const activity = (actor: string, action: string, entity: string, extra: Row = {}) =>
    db.admin_activity!.unshift({ id: activityId++, at: new Date().toISOString(), actor, action, entity, entity_id: null, summary: null, details: {}, ...extra });
  const log: { method: string; path: string; body?: unknown }[] = [];
  const now = () => new Date().toISOString();
  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });

  await page.route(`${FAKE_SUPABASE}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    log.push({ method: route.request().method(), path: url.pathname });
    const method = route.request().method();
    if (url.pathname.endsWith('/token')) {
      const { email, password } = route.request().postDataJSON();
      if (password !== 'correcta') return json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      auth.email = email;
      return json(route, 200, session('aal1'));
    }
    if (url.pathname.endsWith('/logout')) return json(route, 204);
    if (url.pathname.endsWith('/user')) return json(route, 200, user());
    if (url.pathname.endsWith('/factors') && method === 'POST')
      return json(route, 200, { id: 'f1', type: 'totp', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/Cromiqa' } });
    if (/\/factors\/[^/]+$/.test(url.pathname) && method === 'DELETE') return json(route, 200, { id: 'f1' });
    if (url.pathname.endsWith('/challenge')) return json(route, 200, { id: 'c1', expires_at: Math.floor(Date.now() / 1000) + 300 });
    if (url.pathname.endsWith('/verify')) {
      if (route.request().postDataJSON().code !== VALID_TOTP)
        return json(route, 422, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered', message: 'Invalid TOTP code entered' });
      auth.enrolled = true;
      return json(route, 200, session('aal2'));
    }
    return json(route, 200, {});
  });

  await page.route(`${FAKE_SUPABASE}/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop()!;
    const body = req.postData() ? req.postDataJSON() : undefined;
    log.push({ method: req.method(), path: `${url.pathname}${url.search}`, body });
    const aal = aalOf(req.headers()['authorization']);
    const isAdmin = (opts.admin ?? true) && aal === 'aal2';
    if (url.pathname.includes('/rpc/is_admin')) return json(route, 200, isAdmin);
    if (url.pathname.includes('/rpc/log_admin_event')) {
      if (!isAdmin) return json(route, 400, { message: 'not allowed' });
      activity(auth.email, (body as { event: string }).event, 'panel');
      return json(route, 204);
    }
    // Row-level security: only visitors' inserts into the lead tables are allowed without admin rights.
    const publicInsert = req.method() === 'POST' && (table === 'waitlist_leads' || table === 'mechanic_leads');
    const publicRead = req.method() === 'GET' && table === 'site_content';
    if (!isAdmin && !publicInsert && !publicRead) return json(route, req.method() === 'GET' ? 200 : 403, req.method() === 'GET' ? [] : { message: 'permission denied' });
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
            activity(auth.email, i >= 0 ? 'update' : 'insert', 'site_content', { entity_id: it.key, summary: it.key });
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
        if (r) {
          const details = Object.fromEntries(Object.entries(body as Row).filter(([k, v]) => r[k] !== v).map(([k, v]) => [k, { from: r[k], to: v }]));
          Object.assign(r, body);
          activity(auth.email, 'update', table, { entity_id: r.id, summary: r.name ?? r.email, details });
        }
        return json(route, 204);
      }
      case 'DELETE': {
        const r = rows.find((x) => x.id === idEq);
        db[table] = rows.filter((x) => x.id !== idEq);
        if (r) activity(auth.email, 'delete', table, { entity_id: r.id, summary: r.name ?? r.email });
        return json(route, 204);
      }
    }
    return json(route, 405);
  });

  await page.route(`${FAKE_SUPABASE}/storage/v1/**`, (route) => json(route, 200, { Key: 'site/carousel/x.jpg' }));
  return { db, log };
}
