// Admin data access. All writes are authorised server-side by row-level security
// (public.is_admin()); the UI only decides what to show.
import { SITE_BUCKET, getSupabase, supabaseConfigured } from '@/services/supabase';
import type { Benefit, StoredPhoto } from '@/marketing/siteContent';
import type { MechanicLead, MechanicStatus, WaitlistLead } from './types';

async function db() {
  const client = await getSupabase();
  if (!client) throw new Error('Supabase no está configurado.');
  return client;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { error } = await (await db()).auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
}

export async function signOut() {
  await (await db()).auth.signOut();
}

export async function currentEmail(): Promise<string | null> {
  const { data } = await (await db()).auth.getSession();
  return data.session?.user.email ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await (await db()).rpc('is_admin');
  return !error && data === true;
}

export function onAuthChange(cb: () => void) {
  if (!supabaseConfigured) return () => undefined;
  let unsubscribe = () => undefined as void;
  let cancelled = false;
  void getSupabase().then((c) => {
    if (!c || cancelled) return;
    const { data } = c.auth.onAuthStateChange(() => cb());
    unsubscribe = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

// ── Leads ───────────────────────────────────────────────────────────────────
export async function listWaitlist(): Promise<WaitlistLead[]> {
  return check(await (await db()).from('waitlist_leads').select('*').order('created_at', { ascending: false }));
}

export async function deleteWaitlist(id: string) {
  check(await (await db()).from('waitlist_leads').delete().eq('id', id));
}

export async function listMechanics(): Promise<MechanicLead[]> {
  return check(await (await db()).from('mechanic_leads').select('*').order('created_at', { ascending: false }));
}

export async function updateMechanic(id: string, patch: { status?: MechanicStatus; notes?: string }) {
  check(await (await db()).from('mechanic_leads').update(patch).eq('id', id));
}

export async function deleteMechanic(id: string) {
  check(await (await db()).from('mechanic_leads').delete().eq('id', id));
}

// ── Website content ─────────────────────────────────────────────────────────
export async function loadContent(): Promise<{ benefits: Benefit[] | null; photos: StoredPhoto[] | null }> {
  const rows = check(await (await db()).from('site_content').select('key, value')) as { key: string; value: unknown }[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  return { benefits: get('benefits') as Benefit[] | null, photos: get('photos') as StoredPhoto[] | null };
}

export async function saveContent(key: 'benefits' | 'photos', value: unknown) {
  check(await (await db()).from('site_content').upsert({ key, value }));
}

export async function uploadPhoto(file: Blob): Promise<string> {
  const path = `carousel/${crypto.randomUUID?.() ?? Date.now().toString(36)}.jpg`;
  const { error } = await (await db()).storage.from(SITE_BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function removePhotoFile(path: string) {
  await (await db()).storage.from(SITE_BUCKET).remove([path]);
}

// ── Two-factor authentication (TOTP) ────────────────────────────────────────
export type MfaState = { kind: 'ok' } | { kind: 'verify'; factorId: string } | { kind: 'enroll' };

/** Where the signed-in user stands: already aal2, needs to enter a code, or must set up an app. */
export async function mfaState(): Promise<MfaState> {
  const c = await db();
  const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return { kind: 'ok' };
  const { data } = await c.auth.mfa.listFactors();
  const factor = data?.totp[0];
  return factor ? { kind: 'verify', factorId: factor.id } : { kind: 'enroll' };
}

export async function startMfaEnrollment(): Promise<{ factorId: string; qr: string; secret: string }> {
  const c = await db();
  // Drop half-finished setups from earlier attempts so enrollment can start again.
  const { data: existing } = await c.auth.mfa.listFactors();
  await Promise.all((existing?.all ?? []).filter((f) => f.status !== 'verified').map((f) => c.auth.mfa.unenroll({ factorId: f.id })));
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Cromiqa ${new Date().toISOString().slice(0, 10)}`, issuer: 'Cromiqa' });
  if (error || !data || data.type !== 'totp') throw new Error(error?.message ?? 'No se pudo iniciar la configuración.');
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfa(factorId: string, code: string) {
  const { error } = await (await db()).auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? 'Código incorrecto o caducado. Prueba con el siguiente.' : error.message);
}

// ── Activity log ────────────────────────────────────────────────────────────
export interface ActivityEntry {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
  details: Record<string, { from: unknown; to: unknown }>;
}

export async function listActivity(): Promise<ActivityEntry[]> {
  return check(await (await db()).from('admin_activity').select('*').order('at', { ascending: false }).limit(500));
}

/** Records panel events that don't change data. Never blocks the action if logging fails. */
export async function logEvent(event: 'sign_in' | 'export_waitlist' | 'export_mechanics') {
  try {
    await (await db()).rpc('log_admin_event', { event });
  } catch {
    /* best effort */
  }
}
