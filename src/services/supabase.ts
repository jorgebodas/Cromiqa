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

/** Public URL of a file in the site bucket (no client needed). */
export function publicFileUrl(path: string) {
  return supabaseConfigured ? `${url}/storage/v1/object/public/${SITE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}` : '';
}
