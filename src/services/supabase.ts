import type { SupabaseClient } from '@supabase/supabase-js';

// Project values from Supabase → Project Settings → API Keys, overridable with
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (VITE_SUPABASE_URL=off disables it, as
// the e2e builds do). The publishable key is public by design: access is enforced
// by the row-level security rules in supabase/schema.sql.
const DEFAULT_URL = 'https://jochjrhnjgqjzymnhczk.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_zGEat2UGn3uAHiinXQAUpg_f0HWBTSd';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const url = envUrl === 'off' ? '' : (envUrl || DEFAULT_URL).trim().replace(/\/$/, '');
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY).trim();

export const supabaseConfigured = Boolean(url && anonKey);
export const SITE_BUCKET = 'site';

let client: Promise<SupabaseClient> | null = null;

/** The Supabase client, loaded on first use so the public page stays light. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return Promise.resolve(null);
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'cromiqa:admin:auth',
        // Hash routing owns the URL fragment; we only use email + password sign-in.
        detectSessionInUrl: false,
      },
    }),
  );
  return client;
}

/**
 * Shared test world: testers sign in with real accounts and share one demo database. On in
 * production builds when Supabase is configured; VITE_SHARED_DEMO=on|off forces it (staging,
 * e2e and the local dev server keep the per-browser demo).
 */
const sharedFlag = import.meta.env.VITE_SHARED_DEMO;
export const sharedMode = supabaseConfigured && (sharedFlag ? sharedFlag === 'on' : import.meta.env.MODE === 'production' && !import.meta.env.DEV);

let appClient: Promise<SupabaseClient | null> | null = null;

/** Client for testers' sessions (kept apart from the admin panel's session). */
export function getAppSupabase(): Promise<SupabaseClient | null> {
  if (!sharedMode) return Promise.resolve(null);
  appClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, { auth: { persistSession: true, storageKey: 'cromiqa:app:auth', detectSessionInUrl: false } }),
  );
  return appClient;
}

/** Public URL of a file in the site bucket (no client needed). */
export function publicFileUrl(path: string) {
  return supabaseConfigured ? `${url}/storage/v1/object/public/${SITE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}` : '';
}
