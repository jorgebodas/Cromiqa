import type { SupabaseClient } from '@supabase/supabase-js';

// Paste your project's values here (Supabase → Project Settings → API) or set
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. The anon key is public by design:
// access is enforced by the row-level security rules in supabase/schema.sql.
const DEFAULT_URL = '';
const DEFAULT_ANON_KEY = '';

const url = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL).trim().replace(/\/$/, '');
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
