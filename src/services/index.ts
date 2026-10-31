import type { CromiqaBackend } from './backend';
import { LocalBackend } from './localBackend';
import { SharedBackend } from './sharedBackend';
import { sharedMode } from './supabase';
import { supabaseWorld } from './supabaseWorld';

/**
 * Shared test world (real logins, one database for all testers) in production; the
 * per-browser demo everywhere else (dev server, staging, e2e).
 */
export const sharedBackend: SharedBackend | null = sharedMode ? new SharedBackend(supabaseWorld) : null;
export const backend: CromiqaBackend = sharedBackend ?? new LocalBackend();
export { sharedMode };

export type { CromiqaBackend } from './backend';
