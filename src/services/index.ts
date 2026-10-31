import type { CromiqaBackend } from './backend';
import { LocalBackend } from './localBackend';

// Swap this line for a Supabase-backed implementation of CromiqaBackend.
export const backend: CromiqaBackend = new LocalBackend();

export type { CromiqaBackend } from './backend';
