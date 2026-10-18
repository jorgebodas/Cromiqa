// Lead capture (waitlist + mechanics) without a backend, via FormSubmit's AJAX API:
// each submission arrives as an email. Forms stay hidden until LEAD_EMAIL is set, so the
// public page never shows a form that cannot deliver.
// FormSubmit sends one activation email on the first submission; after activating you can
// replace the address with the random alias it provides to keep your email out of the code.
// Temporary: owner's personal inbox until a dedicated Cromiqa address exists (see README → Next steps).
import { getSupabase, supabaseConfigured } from '@/services/supabase';

const DEFAULT_LEAD_EMAIL = 'jorgebodasguerra@gmail.com';
export const LEAD_EMAIL = (import.meta.env.VITE_LEAD_EMAIL || DEFAULT_LEAD_EMAIL).trim();
export const leadsEnabled = LEAD_EMAIL.length > 0 || supabaseConfigured;

export type LeadKind = 'waitlist' | 'mechanic';

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * Emails already registered from this browser, per form. Without a backend this is the only
 * duplicate check available: it cannot see registrations made on other devices.
 */
const emailsKey = (kind: LeadKind) => `cromiqa:lead:${kind}:emails`;
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function readEmails(kind: LeadKind): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(emailsKey(kind)) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function isRegistered(kind: LeadKind, email: string) {
  return readEmails(kind).includes(normalizeEmail(email));
}

function remember(kind: LeadKind, email: string) {
  try {
    localStorage.setItem(emailsKey(kind), JSON.stringify([...new Set([...readEmails(kind), normalizeEmail(email)])]));
  } catch {
    /* private mode: no duplicate memory */
  }
}

export class DuplicateLeadError extends Error {}

const TABLE: Record<LeadKind, string> = { waitlist: 'waitlist_leads', mechanic: 'mechanic_leads' };
const dash = (v?: string) => (v && v !== '—' ? v : null);

/** Database row for each form (only the columns visitors are allowed to write). */
function toRow(kind: LeadKind, f: Record<string, string>) {
  return kind === 'waitlist'
    ? { email: normalizeEmail(f.email!), zone: dash(f.zona === 'Sin indicar' ? undefined : f.zona), source: 'landing' }
    : {
        name: f.nombre,
        workshop: dash(f.taller),
        email: normalizeEmail(f.email!),
        phone: dash(f.telefono),
        zone: dash(f.zona),
        specialty: dash(f.especialidad),
      };
}

const duplicateMessage = (kind: LeadKind) =>
  kind === 'waitlist' ? 'Este email ya está en la lista de espera.' : 'Este email ya está registrado como mecánico.';

/** Email notification through FormSubmit (best effort when Supabase is the source of truth). */
async function notifyByEmail(kind: LeadKind, fields: Record<string, string>, honeypot: string) {
  const subject = kind === 'waitlist' ? 'Cromiqa · Nuevo registro en lista de espera' : 'Cromiqa · Nuevo mecánico interesado';
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ tipo: kind === 'waitlist' ? 'Lista de espera' : 'Mecánico', ...fields, _subject: subject, _template: 'table', _honey: honeypot }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `HTTP ${res.status}`);
}

export async function submitLead(kind: LeadKind, fields: Record<string, string> & { email: string }, honeypot = '') {
  if (honeypot) return; // bots: pretend success, store nothing
  if (import.meta.env.VITE_STAGING) {
    // Staging preview: never touch real data or email the owner.
    if (isRegistered(kind, fields.email)) throw new DuplicateLeadError(duplicateMessage(kind));
    await new Promise((r) => setTimeout(r, 600));
    return remember(kind, fields.email);
  }
  const supabase = await getSupabase();
  if (supabase) {
    // The database is the source of truth: a unique email catches duplicates from any device.
    const { error } = await supabase.from(TABLE[kind]).insert(toRow(kind, fields));
    if (error) {
      if (error.code === '23505') throw new DuplicateLeadError(duplicateMessage(kind));
      throw new Error(error.message);
    }
    remember(kind, fields.email);
    if (LEAD_EMAIL) void notifyByEmail(kind, fields, honeypot).catch(() => undefined);
    return;
  }
  // No backend yet: email only, with a per-browser duplicate check.
  if (isRegistered(kind, fields.email)) throw new DuplicateLeadError(duplicateMessage(kind));
  await notifyByEmail(kind, fields, honeypot);
  remember(kind, fields.email);
}

/**
 * Sends FormSubmit's one-time activation request for `email` from the owner's browser.
 * The address is typed at runtime and never stored or committed.
 */
export async function requestLeadActivation(email: string) {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email.trim())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      tipo: 'Activación',
      mensaje: 'Activación de los formularios de Cromiqa (lista de espera y mecánicos).',
      _subject: 'Cromiqa · Activa el formulario de registros',
      _template: 'table',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.message ?? '';
}
