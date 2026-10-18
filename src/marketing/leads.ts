// Lead capture (waitlist + mechanics) without a backend, via FormSubmit's AJAX API:
// each submission arrives as an email. Forms stay hidden until LEAD_EMAIL is set, so the
// public page never shows a form that cannot deliver.
// FormSubmit sends one activation email on the first submission; after activating you can
// replace the address with the random alias it provides to keep your email out of the code.
// Temporary: owner's personal inbox until a dedicated Cromiqa address exists (see README → Next steps).
const DEFAULT_LEAD_EMAIL = 'jorgebodasguerra@gmail.com';
export const LEAD_EMAIL = (import.meta.env.VITE_LEAD_EMAIL || DEFAULT_LEAD_EMAIL).trim();
export const leadsEnabled = LEAD_EMAIL.length > 0;

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

export async function submitLead(kind: LeadKind, fields: Record<string, string> & { email: string }, honeypot = '') {
  if (isRegistered(kind, fields.email)) {
    throw new DuplicateLeadError(
      kind === 'waitlist' ? 'Este email ya está en la lista de espera.' : 'Este email ya está registrado como mecánico.',
    );
  }
  if (import.meta.env.VITE_STAGING) {
    // Staging preview: never email the owner; just pretend it worked.
    await new Promise((r) => setTimeout(r, 600));
    void honeypot;
    return remember(kind, fields.email);
  }
  const subject = kind === 'waitlist' ? 'Cromiqa · Nuevo registro en lista de espera' : 'Cromiqa · Nuevo mecánico interesado';
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ tipo: kind === 'waitlist' ? 'Lista de espera' : 'Mecánico', ...fields, _subject: subject, _template: 'table', _honey: honeypot }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `HTTP ${res.status}`);
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
