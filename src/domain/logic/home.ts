// What each Home shows: items that need the person now, derived from the stored requests
// (nothing invented). Pure functions, so both Homes and the tests use the same rules.
import type { Mechanic, Review, ServiceRequest } from '../types';
import { toISODate } from '../utils';
import { currentProposal } from './requests';

const DAY = 24 * 60 * 60 * 1000;

// ── Cyclist ──────────────────────────────────────────────────────────────────

export type CyclistAttentionKind = 'proposal' | 'clarify' | 'declined' | 'review';

export interface CyclistAttention {
  kind: CyclistAttentionKind;
  request: ServiceRequest;
  /** For proposals: how many quotes are waiting in the same request. */
  count?: number;
}

const isLive = (r: ServiceRequest) => ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress', 'completed'].includes(r.status);

/**
 * Things only the cyclist can move forward, one per request: quotes to compare, a mechanic
 * who needs a clarification (open proposal), a request every invited mechanic declined
 * (recently), a finished service still to review. Most urgent first.
 */
export function cyclistAttention(requests: ServiceRequest[], reviews: Review[], now = new Date()): CyclistAttention[] {
  const items: (CyclistAttention & { rank: number; at: string })[] = [];
  const byCase = new Map<string, ServiceRequest[]>();
  for (const r of requests) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  for (const threads of byCase.values()) {
    const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
    if (quotes.length) {
      const first = [...quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
      items.push({ kind: 'proposal', request: first, count: quotes.length, rank: 0, at: first.updatedAt });
    }
    for (const r of threads) {
      const last = r.events[r.events.length - 1];
      if (r.status === 'awaiting_proposal' && r.openProposal && last && last.by === 'mechanic' && (last.type === 'open_proposal_sent' || last.type === 'message'))
        items.push({ kind: 'clarify', request: r, rank: 1, at: last.at });
      if (r.status === 'completed' && !reviews.some((v) => v.requestId === r.id) && now.getTime() - new Date(r.updatedAt).getTime() < 30 * DAY)
        items.push({ kind: 'review', request: r, rank: 3, at: r.updatedAt });
    }
    // Declines only need the cyclist once no invitation of the request is still alive.
    const declines = threads.filter((r) => r.status === 'cancelled' && r.events[r.events.length - 1]?.type === 'rejected_by_mechanic');
    const lastDecline = declines.map((r) => r.events[r.events.length - 1]!.at).sort().pop();
    if (lastDecline && !threads.some(isLive) && now.getTime() - new Date(lastDecline).getTime() < 7 * DAY)
      items.push({ kind: 'declined', request: declines[0]!, rank: 2, at: lastDecline });
  }
  return items.sort((a, b) => a.rank - b.rank || b.at.localeCompare(a.at)).map(({ kind, request, count }) => ({ kind, request, count }));
}

/**
 * Requests in motion that don't need the cyclist right now, one row per request (its lead
 * invitation): booked work first, by date, then requests still waiting for answers.
 */
export function cyclistInProgress(requests: ServiceRequest[]): ServiceRequest[] {
  const booked = (r: ServiceRequest) => r.status === 'confirmed' || r.status === 'in_progress';
  const when = (r: ServiceRequest) => {
    const p = currentProposal(r);
    return p ? `${p.date}T${p.time}` : '9999';
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

export type MechanicAttentionKind = 'respond' | 'message' | 'propose' | 'start' | 'finish';

export interface MechanicAttention {
  kind: MechanicAttentionKind;
  request: ServiceRequest;
}

const OPEN = ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress'];

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
    else if (r.status === 'awaiting_proposal') items.push({ kind: 'propose', request: r, rank: 2, at: r.updatedAt });
    else if (r.status === 'confirmed' && (currentProposal(r)?.date ?? '9999') <= today) items.push({ kind: 'start', request: r, rank: 3, at: r.updatedAt });
    else if (r.status === 'in_progress') items.push({ kind: 'finish', request: r, rank: 4, at: r.updatedAt });
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
    withAppointment: requests.filter((r) => r.status === 'confirmed').length,
    active: requests.filter((r) => r.status === 'in_progress').length,
  };
}

/** Booked work with a date, soonest first. */
export function upcomingAppointments(requests: ServiceRequest[]): ServiceRequest[] {
  return requests
    .filter((r) => r.status === 'confirmed' || r.status === 'in_progress')
    .filter((r) => currentProposal(r))
    .sort((a, b) => {
      const pa = currentProposal(a)!;
      const pb = currentProposal(b)!;
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
  if (profileGaps(m).length) return 'incomplete';
  return m.demoVerified ? 'active' : 'pending_verification';
}
