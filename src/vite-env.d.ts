/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ACCESS_HASH?: string;
  readonly VITE_ACCESS_GATE?: string;
}

interface ImportMetaEnv {
  readonly VITE_LEAD_EMAIL?: string;
  readonly VITE_STAGING?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
