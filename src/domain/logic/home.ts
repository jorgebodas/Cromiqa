// What each Home shows: items that need the person now, derived from the stored requests
// (nothing invented). Pure functions, so both Homes and the tests use the same rules.
import type { Mechanic, Review, ServiceRequest } from '../types';
import { toISODate } from '../utils';
import { autoCloseReminderDue, currentProposal, openIncident } from './requests';
import { compareRanked, declinedRecently, type Ranked } from './hub';
import { caseHref, threadHref } from './cases';

const DAY = 24 * 60 * 60 * 1000;

// ── Cyclist ──────────────────────────────────────────────────────────────────

export type CyclistAttentionKind = 'proposal' | 'clarify' | 'appointment' | 'confirm' | 'incident' | 'declined' | 'review';

export interface CyclistAttention {
  kind: CyclistAttentionKind;
  request: ServiceRequest;
  /** For proposals: how many quotes are waiting in the same request. */
  count?: number;
  /** For `confirm`: the 72 h closure is less than a day away. */
  closingSoon?: boolean;
}

/**
 * Things only the cyclist can move forward, one per request: quotes to compare, a mechanic
 * who needs a clarification (open proposal), a request every invited mechanic declined
 * (recently), a finished service still to review. Most urgent first.
 */
export function cyclistAttention(requests: ServiceRequest[], reviews: Review[], now = new Date()): CyclistAttention[] {
  // Same ranking as the floating Request Hub (incidents, confirmations, quotes, messages…), so
  // the two never disagree about what matters most.
  const items: (CyclistAttention & Ranked)[] = [];
  const byCase = new Map<string, ServiceRequest[]>();
  for (const r of requests) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  for (const threads of byCase.values()) {
    const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
    if (quotes.length) {
      const first = [...quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
      const at = quotes.map((r) => currentProposal(r)?.createdAt ?? r.updatedAt).sort()[0]!;
      items.push({ kind: 'proposal', request: first, count: quotes.length, priority: 3, at });
    }
    for (const r of threads) {
      const last = r.events[r.events.length - 1];
      if (r.status === 'awaiting_proposal' && r.openProposal && last && last.by === 'mechanic' && (last.type === 'open_proposal_sent' || last.type === 'message'))
        items.push({ kind: 'clarify', request: r, priority: 4, at: last.at });
      // After hiring: a date proposed by the mechanic (or none yet), the work to confirm, an open problem.
      if (r.status === 'confirmed' && (r.appointment?.pending ? r.appointment.pending.by === 'mechanic' : !r.appointment?.confirmed))
        items.push({ kind: 'appointment', request: r, priority: 2, at: r.appointment?.pending?.at ?? r.updatedAt });
      const incident = r.status === 'awaiting_completion' ? openIncident(r) : undefined;
      if (incident) items.push({ kind: 'incident', request: r, priority: 1, at: incident.openedAt });
      else if (r.status === 'awaiting_completion') {
        const closingSoon = autoCloseReminderDue(r, now);
        items.push({ kind: 'confirm', request: r, priority: 2, deadline: closingSoon, at: r.finishedAt ?? r.updatedAt, closingSoon });
      }
      if (r.status === 'completed' && !reviews.some((v) => v.requestId === r.id) && now.getTime() - new Date(r.updatedAt).getTime() < 30 * DAY)
        items.push({ kind: 'review', request: r, priority: 6, at: r.updatedAt });
    }
    // Declines only need the cyclist once no invitation of the request is still alive.
    const declinedAt = declinedRecently(threads, now);
    if (declinedAt) {
      const declined = threads.find((r) => r.status === 'cancelled' && r.events[r.events.length - 1]?.type === 'rejected_by_mechanic')!;
      items.push({ kind: 'declined', request: declined, priority: 3, at: declinedAt });
    }
  }
  return items.sort(compareRanked).map(({ kind, request, count, closingSoon }) => ({ kind, request, count, closingSoon }));
}

/** Where a pending item opens: the request (to compare quotes or invite others) or the conversation with that mechanic. */
export function attentionHref(item: CyclistAttention): string {
  return item.kind === 'proposal' || item.kind === 'declined' ? caseHref(item.request) : threadHref(item.request);
}

/**
 * Requests in motion that don't need the cyclist right now, one row per request (its lead
 * invitation): booked work first, by date, then requests still waiting for answers.
 */
export function cyclistInProgress(requests: ServiceRequest[]): ServiceRequest[] {
  const booked = (r: ServiceRequest) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status);
  const when = (r: ServiceRequest) => {
    const a = r.appointment?.confirmed;
    return a ? `${a.date}T${a.time}` : '9999';
  };
  const byCase = new Map<string, ServiceRequest[]>();
  for (const r of requests) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  const rows: ServiceRequest[] = [];
  for (const threads of byCase.values()) {
    const hired = threads.find(booked);
    if (hired) rows.push(hired);
    else if (!threads.some((r) => r.status === 'proposal_received' || r.status === 'completed' || r.openProposal)) {
      const waiting = threads.filter((r) => r.status === 'sent' || r.status === 'awaiting_proposal');
      if (waiting.length) rows.push([...waiting].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!);
    }
  }
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
