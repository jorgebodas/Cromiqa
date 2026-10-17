// Lead capture (waitlist + mechanics) without a backend, via FormSubmit's AJAX API:
// each submission arrives as an email. Forms stay hidden until LEAD_EMAIL is set, so the
// public page never shows a form that cannot deliver.
// FormSubmit sends one activation email on the first submission; after activating you can
// replace the address with the random alias it provides to keep your email out of the code.
const DEFAULT_LEAD_EMAIL = '';
export const LEAD_EMAIL = (import.meta.env.VITE_LEAD_EMAIL || DEFAULT_LEAD_EMAIL).trim();
export const leadsEnabled = LEAD_EMAIL.length > 0;

export type LeadKind = 'waitlist' | 'mechanic';

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export async function submitLead(kind: LeadKind, fields: Record<string, string>, honeypot = '') {
  const subject = kind === 'waitlist' ? 'Cromiqa · Nuevo registro en lista de espera' : 'Cromiqa · Nuevo mecánico interesado';
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(LEAD_EMAIL)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ tipo: kind === 'waitlist' ? 'Lista de espera' : 'Mecánico', ...fields, _subject: subject, _template: 'table', _honey: honeypot }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || `HTTP ${res.status}`);
  try {
    localStorage.setItem(`cromiqa:lead:${kind}`, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function alreadySubmitted(kind: LeadKind) {
  try {
    return !!localStorage.getItem(`cromiqa:lead:${kind}`);
  } catch {
    return false;
  }
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
