// What each Home shows: items that need the person now, derived from the stored requests
// (nothing invented). Pure functions, so both Homes and the tests use the same rules.
import type { DemoDatabase, Mechanic, PendingActionType, Review, ServiceRequest } from '../types';
import { openActionsFor } from './pendingActions';
import { toISODate } from '../utils';
import { autoCloseReminderDue, currentProposal, openIncident } from './requests';
import { compareRanked, declinedRecently, type Ranked } from './hub';
import { requestHref } from './cases';

const DAY = 24 * 60 * 60 * 1000;

// ── Cyclist ──────────────────────────────────────────────────────────────────

export type CyclistAttentionKind = 'proposal' | 'clarify' | 'appointment' | 'confirm' | 'incident' | 'declined' | 'review';

export interface CyclistAttention {
  kind: CyclistAttentionKind;
  request: ServiceRequest;
  /** For `confirm`: the 72 h closure is less than a day away. */
  closingSoon?: boolean;
}

/**
 * Things only the cyclist can move forward, one per request (one request = one mechanic): a
 * quote to review, a question to answer, a date to confirm or propose, a finished service to
 * confirm, an open incident; plus, for Home only, a request the mechanic declined (recently)
 * and a finished service to review. Order: incidents, appointments, quotes, information,
 * completion; then a real deadline, then the oldest pending action (the Request Hub's ranking).
 */
export function cyclistAttention(requests: ServiceRequest[], reviews: Review[], now = new Date()): CyclistAttention[] {
  const items: (CyclistAttention & Ranked)[] = [];
  for (const r of requests) {
    const last = r.events[r.events.length - 1];
    const quote = r.status === 'proposal_received' ? currentProposal(r) : undefined;
    if (quote?.status === 'pending') items.push({ kind: 'proposal', request: r, priority: 3, at: quote.createdAt });
    if (r.status === 'awaiting_proposal' && r.openProposal && last && last.by === 'mechanic' && (last.type === 'open_proposal_sent' || last.type === 'message'))
      items.push({ kind: 'clarify', request: r, priority: 4, at: last.at });
    // After hiring: a date proposed by the mechanic (or none yet), the work to confirm, an open problem.
    if (r.status === 'confirmed' && (r.appointment?.pending ? r.appointment.pending.by === 'mechanic' : !r.appointment?.confirmed))
      items.push({ kind: 'appointment', request: r, priority: 2, at: r.appointment?.pending?.at ?? r.updatedAt });
    const incident = r.status === 'awaiting_completion' ? openIncident(r) : undefined;
    if (incident) items.push({ kind: 'incident', request: r, priority: 1, at: incident.openedAt });
    else if (r.status === 'awaiting_completion') {
      const closingSoon = autoCloseReminderDue(r, now);
      items.push({ kind: 'confirm', request: r, priority: 5, deadline: closingSoon, at: r.finishedAt ?? r.updatedAt, closingSoon });
    }
    if (r.status === 'completed' && !reviews.some((v) => v.requestId === r.id) && now.getTime() - new Date(r.updatedAt).getTime() < 30 * DAY)
      items.push({ kind: 'review', request: r, priority: 7, at: r.updatedAt });
    const declinedAt = declinedRecently(r, now);
    if (declinedAt) items.push({ kind: 'declined', request: r, priority: 3, at: declinedAt });
  }
  return items.map((i) => ({ ...i, id: i.request.id })).sort(compareRanked).map(({ kind, request, closingSoon }) => ({ kind, request, closingSoon }));
}

const ATTENTION_KIND: Record<PendingActionType, CyclistAttentionKind> = {
  incident_response: 'incident',
  appointment_confirmation: 'appointment',
  quote_decision: 'proposal',
  information_required: 'clarify',
  service_confirmation: 'confirm',
};

/**
 * The cyclist's unresolved PendingActions (see `pendingActions.ts`) as rows for the Request Hub
 * and Home: in their order, with the live details each row shows (deadline).
 */
export function attentionFromActions(db: Pick<DemoDatabase, 'requests' | 'pendingActions'>, userId: string | undefined, now = new Date()): CyclistAttention[] {
  return openActionsFor(db.pendingActions ?? [], userId).flatMap((a) => {
    const request = db.requests.find((r) => r.id === a.requestId);
    if (!request) return [];
    const closingSoon = !!a.dueAt && now.getTime() >= new Date(a.dueAt).getTime() - 24 * 60 * 60 * 1000;
    return [{ kind: ATTENTION_KIND[a.type], request, closingSoon: a.type === 'service_confirmation' ? closingSoon : undefined }];
  });
}

/**
 * Home's "Requiere tu atención": the cyclist's PendingActions first (the same ones the Request
 * Hub counts), then two Home-only nudges that are not decisions: invite others when every
 * mechanic declined, and review a finished service.
 */
export function homeAttention(db: Pick<DemoDatabase, 'requests' | 'pendingActions' | 'reviews'>, userId: string | undefined, now = new Date()): CyclistAttention[] {
  if (!userId) return [];
  const extras = cyclistAttention(db.requests.filter((r) => r.ownerId === userId), db.reviews, now).filter((i) => i.kind === 'declined' || i.kind === 'review');
  return [...attentionFromActions(db, userId, now), ...extras];
}

/** What to do about a pending item, in a few words (request cards and the request page). */
export function attentionActionLabel(item: CyclistAttention): string {
  const r = item.request;
  switch (item.kind) {
    case 'proposal':
      return 'Revisa el presupuesto';
    case 'appointment':
      return r.appointment?.confirmed ? 'Confirma la nueva fecha' : 'Confirma la fecha propuesta';
    case 'clarify':
      return 'Responde al mecánico';
    case 'confirm':
      return { repair: 'Confirma la reparación', maintenance: 'Confirma el mantenimiento', inspection: 'Confirma la inspección', diagnosis: 'Confirma el diagnóstico' }[r.category];
    case 'incident':
      return 'Revisa la incidencia';
    case 'declined':
      return 'Pídeselo a otro mecánico';
    default:
      return 'Valora el servicio';
  }
}

/** Where a pending item opens: its request, with its mechanic. */
export function attentionHref(item: CyclistAttention): string {
  return requestHref(item.request);
}

/**
 * Requests in motion that don't need the cyclist right now: booked work first, by date, then
 * requests still waiting for an answer.
 */
export function cyclistInProgress(requests: ServiceRequest[]): ServiceRequest[] {
  const booked = (r: ServiceRequest) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status);
  const when = (r: ServiceRequest) => {
    const a = r.appointment?.confirmed;
    return a ? `${a.date}T${a.time}` : '9999';
  };
  const rows = requests.filter((r) => booked(r) || ((r.status === 'sent' || r.status === 'awaiting_proposal') && !r.openProposal));
  return rows.sort((a, b) => Number(booked(b)) - Number(booked(a)) || (booked(a) ? when(a).localeCompare(when(b)) : b.updatedAt.localeCompare(a.updatedAt)));
}

// ── Mechanic ─────────────────────────────────────────────────────────────────

export type MechanicAttentionKind = 'respond' | 'message' | 'incident' | 'propose' | 'appointment' | 'start' | 'finish';

export interface MechanicAttention {
  kind: MechanicAttentionKind;
  request: ServiceRequest;
}

const OPEN = ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress', 'awaiting_completion'];

/**
 * The mechanic's to-do list, by urgency: new invitations to answer, client messages waiting
 * for a reply, proposals still to send, appointments due to start, jobs to mark finished.
 */
export function mechanicAttention(requests: ServiceRequest[], now = new Date()): MechanicAttention[] {
  const today = toISODate(now);
  const items: (MechanicAttention & { rank: number; at: string })[] = [];
  for (const r of requests) {
    const last = r.events[r.events.length - 1];
    if (r.status === 'sent') items.push({ kind: 'respond', request: r, rank: 0, at: r.createdAt });
    else if (OPEN.includes(r.status) && last?.type === 'message' && last.by === 'owner') items.push({ kind: 'message', request: r, rank: 1, at: last.at });
    else if (r.status === 'awaiting_completion' && openIncident(r)) items.push({ kind: 'incident', request: r, rank: 1, at: r.updatedAt });
    else if (r.status === 'awaiting_proposal') items.push({ kind: 'propose', request: r, rank: 2, at: r.updatedAt });
    else if (r.status === 'confirmed' && (r.appointment?.pending ? r.appointment.pending.by === 'owner' : !r.appointment?.confirmed))
      items.push({ kind: 'appointment', request: r, rank: 3, at: r.appointment?.pending?.at ?? r.updatedAt });
    else if (r.status === 'confirmed' && r.appointment?.confirmed && r.appointment.confirmed.date <= today) items.push({ kind: 'start', request: r, rank: 4, at: r.updatedAt });
    else if (r.status === 'in_progress') items.push({ kind: 'finish', request: r, rank: 5, at: r.updatedAt });
  }
  return items.sort((a, b) => a.rank - b.rank || a.at.localeCompare(b.at)).map(({ kind, request }) => ({ kind, request }));
}

export interface MechanicCounts {
  unanswered: number;
  withAppointment: number;
  active: number;
}

export function mechanicCounts(requests: ServiceRequest[]): MechanicCounts {
  return {
    unanswered: requests.filter((r) => r.status === 'sent' || r.status === 'awaiting_proposal').length,
    withAppointment: requests.filter((r) => r.status === 'confirmed' && !r.appointment?.confirmed).length,
    active: requests.filter((r) => r.status === 'in_progress').length,
  };
}

/** Booked work with a confirmed appointment, soonest first. */
export function upcomingAppointments(requests: ServiceRequest[]): ServiceRequest[] {
  return requests
    .filter((r) => (r.status === 'confirmed' || r.status === 'in_progress') && r.appointment?.confirmed)
    .sort((a, b) => {
      const pa = a.appointment!.confirmed!;
      const pb = b.appointment!.confirmed!;
      return `${pa.date}T${pa.time}`.localeCompare(`${pb.date}T${pb.time}`);
    });
}

// ── Professional profile ─────────────────────────────────────────────────────

export type ProfileGap = 'presentation' | 'services' | 'coverage' | 'availability';

/** What a professional profile still lacks before it can be found and hired. */
export function profileGaps(m: Mechanic): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (m.headline.trim().length < 5 || m.bio.trim().length < 20) gaps.push('presentation');
  if (m.services.length === 0) gaps.push('services');
  if (!m.homeService && !m.workshop) gaps.push('coverage');
  else if (m.homeService && m.serviceAreas.length === 0) gaps.push('coverage');
  if (m.weeklyAvailability.length === 0) gaps.push('availability');
  return gaps;
}

export type ProfileStatus = 'incomplete' | 'pending_verification' | 'active';

/**
 * Where the profile stands. Verification is a demo flag today (Cromiqa has not verified any
 * real professional); a real backend would own this state.
 */
export function profileStatus(m: Mechanic): ProfileStatus {
  if (m.listing === 'pending_verification') return 'pending_verification';
  if (profileGaps(m).length) return 'incomplete';
  return 'active';
}
