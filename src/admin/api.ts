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
