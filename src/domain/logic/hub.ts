// The Request Hub: what the cyclist's floating control says about their active requests.
// Everything is derived from the stored invitations (no invented progress), one item per
// request, the ones that need the cyclist first.
import type { ID, ServiceRequest } from '../types';
import { caseHref, caseStatus, groupCases, leadThread, threadHref } from './cases';
import { autoCloseReminderDue, currentProposal, openIncident } from './requests';

/**
 * Lower = more urgent, by what happens if the cyclist doesn't act:
 * 1 incidents · 2 confirmations and dates · 3 quotes and choosing a mechanic · 4 messages ·
 * 5 waiting on someone else (never above anything that needs the cyclist).
 */
export type HubPriority = 1 | 2 | 3 | 4 | 5;

/** Every situation a request can be in, from the cyclist's side. All map to stored states. */
export type HubSituation =
  | 'incident' // awaiting_completion with an open incident
  | 'confirm_delivery' // awaiting_completion, the 72 h closure is less than a day away
  | 'work_finished' // awaiting_completion: the mechanic marked the work finished
  | 'new_date' // confirmed: the mechanic proposes a change or answers the cyclist's date
  | 'confirm_appointment' // confirmed: the mechanic proposes the first date
  | 'propose_date' // confirmed: hired, no date proposed yet
  | 'quotes' // proposal_received ×2+
  | 'quote' // proposal_received ×1
  | 'choose_mechanic' // every invited mechanic declined (recently): invite others
  | 'message' // awaiting_proposal with the mechanic's last word (open proposal or message)
  | 'in_progress' // in_progress
  | 'appointment_confirmed' // confirmed with an agreed date
  | 'waiting_confirmation' // confirmed: the cyclist proposed a date, the mechanic hasn't answered
  | 'waiting_quotes' // awaiting_proposal: a mechanic is preparing a quote
  | 'searching'; // sent: no mechanic has answered yet

/** Group and order inside the group (waiting states: the most relevant first). */
export const SITUATION_RANK: Record<HubSituation, [HubPriority, number]> = {
  incident: [1, 0],
  confirm_delivery: [2, 0],
  work_finished: [2, 0],
  new_date: [2, 0],
  confirm_appointment: [2, 0],
  propose_date: [2, 0],
  quotes: [3, 0],
  quote: [3, 0],
  choose_mechanic: [3, 0],
  message: [4, 0],
  in_progress: [5, 0],
  appointment_confirmed: [5, 1],
  waiting_confirmation: [5, 2],
  waiting_quotes: [5, 3],
  searching: [5, 4],
};

/** What decides which of two things comes first, shared by the floating hub and Home's "Requiere tu atención". */
export interface Ranked {
  priority: number;
  order?: number;
  /** A real deadline is close (the 72 h closure). Never invented. */
  deadline?: boolean;
  /** Since when it has been waiting: the oldest pending action goes first. */
  at: string;
}

/** Priority, then a real deadline, then the oldest pending action. Stable for equal items. */
export function compareRanked(a: Ranked, b: Ranked): number {
  return a.priority - b.priority || (a.order ?? 0) - (b.order ?? 0) || Number(!!b.deadline) - Number(!!a.deadline) || a.at.localeCompare(b.at);
}

export interface HubItem extends Ranked {
  caseId: ID;
  threads: ServiceRequest[];
  /** The invitation that best represents the request (hired, best quote, newest). */
  lead: ServiceRequest;
  /** The chip's message: "2 presupuestos para comparar", "Nueva fecha propuesta"… */
  label: string;
  /** What to do, in a few words, when the cyclist has to act. */
  action?: string;
  priority: HubPriority;
  pending: boolean;
  /** The next meaningful action and where the hub opens it. */
  quick: QuickAction;
  updatedAt: string;
}

/** Where the hub opens a request: the screen for its next meaningful action. */
export type QuickScreen = 'compare' | 'appointment' | 'completion' | 'incident' | 'tracking' | 'status';

export interface QuickAction extends Ranked {
  situation: HubSituation;
  /** The chip's message, in sentence case. */
  label: string;
  /** What to do, in a few words, when the cyclist has to act. */
  action?: string;
  screen: QuickScreen;
  /** Opened directly instead of the hub panel (the chat, the request page). */
  href?: string;
  /** The invitation the screen is about (the hired one, or the lead). */
  threadId: ID;
  priority: HubPriority;
  requiresAction: boolean;
}

/** "reparación", "mantenimiento"…: the service, for "Reparación en curso" and friends. */
const SERVICE_NOUN: Record<ServiceRequest['category'], [string, string, string]> = {
  repair: ['la reparación', 'Reparación', 'Reparación terminada'],
  maintenance: ['el mantenimiento', 'Mantenimiento', 'Mantenimiento terminado'],
  inspection: ['la inspección', 'Inspección', 'Inspección terminada'],
  diagnosis: ['el diagnóstico', 'Diagnóstico', 'Diagnóstico terminado'],
};

const lastEvent = (r: ServiceRequest) => r.events[r.events.length - 1];
const DAY = 24 * 60 * 60 * 1000;
const isLive = (r: ServiceRequest) => ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress', 'awaiting_completion', 'completed'].includes(r.status);

/** A request every invited mechanic declined in the last week: the cyclist should invite others. */
export function declinedRecently(threads: ServiceRequest[], now = new Date()): string | undefined {
  const declines = threads.filter((r) => r.status === 'cancelled' && lastEvent(r)?.type === 'rejected_by_mechanic');
  const at = declines.map((r) => lastEvent(r)!.at).sort().pop();
  return at && !threads.some(isLive) && now.getTime() - new Date(at).getTime() < 7 * DAY ? at : undefined;
}

/**
 * The one place that decides a request's situation: its message, destination and priority.
 * Used by the collapsed chip, the hub panel and (through the same ranking) Home. It only points
 * to a screen; nothing is accepted, confirmed or closed on the cyclist's behalf.
 */
export function getRequestQuickAction(threads: ServiceRequest[], now = new Date()): QuickAction {
  const lead = leadThread(threads);
  const [noun, Noun, done] = SERVICE_NOUN[lead.category];
  const make = (situation: HubSituation, q: { label: string; action?: string; screen: QuickScreen; href?: string; threadId?: ID; at: string; deadline?: boolean }): QuickAction => {
    const [priority, order] = SITUATION_RANK[situation];
    return { situation, ...q, threadId: q.threadId ?? lead.id, priority, order, requiresAction: priority <= 4 };
  };
  const hired = threads.find((r) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status));
  if (hired?.status === 'awaiting_completion') {
    const incident = openIncident(hired);
    if (incident) return make('incident', { label: 'Incidencia pendiente', action: 'Sigue el problema con el mecánico', screen: 'incident', threadId: hired.id, at: incident.openedAt });
    const at = hired.finishedAt ?? hired.updatedAt;
    if (autoCloseReminderDue(hired, now))
      return make('confirm_delivery', { label: 'Confirma la entrega', action: 'Se cerrará sola en menos de 24 h', screen: 'completion', threadId: hired.id, at, deadline: true });
    return make('work_finished', { label: done, action: 'Confirma que está bien o reporta un problema', screen: 'completion', threadId: hired.id, at });
  }
  if (hired?.status === 'confirmed') {
    const a = hired.appointment;
    if (a?.pending?.by === 'mechanic') {
      // A change of an agreed date, or an answer to the cyclist's own proposal: a new date.
      const change = !!a.confirmed || hired.events.some((e) => e.type === 'appointment_proposed' && e.by === 'owner');
      return change
        ? make('new_date', { label: 'Nueva fecha propuesta', action: 'Confirma la fecha o propón otra', screen: 'appointment', threadId: hired.id, at: a.pending.at })
        : make('confirm_appointment', { label: 'Confirma tu cita', action: 'Confirma la fecha o propón otra', screen: 'appointment', threadId: hired.id, at: a.pending.at });
    }
    if (!a?.confirmed && !a?.pending)
      return make('propose_date', { label: `Elige fecha para ${noun}`, action: 'Propón una fecha al mecánico', screen: 'appointment', threadId: hired.id, at: hired.updatedAt });
  }
  const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
  if (quotes.length) {
    const at = quotes.map((r) => currentProposal(r)?.createdAt ?? r.updatedAt).sort()[0]!;
    return quotes.length === 1
      ? make('quote', { label: 'Nuevo presupuesto recibido', action: 'Revisa el presupuesto', screen: 'compare', at })
      : make('quotes', { label: `${quotes.length} presupuestos para comparar`, action: 'Compara y elige uno', screen: 'compare', at });
  }
  const declinedAt = !hired ? declinedRecently(threads, now) : undefined;
  if (declinedAt) return make('choose_mechanic', { label: 'Elige un mecánico', action: 'Invita a otros mecánicos', screen: 'status', href: caseHref(lead), at: declinedAt });
  const asked = threads.find((r) => r.status === 'awaiting_proposal' && r.openProposal && lastEvent(r)?.by === 'mechanic');
  if (asked) return make('message', { label: 'Nuevo mensaje del mecánico', action: 'Responde al mecánico', screen: 'status', href: threadHref(asked), threadId: asked.id, at: lastEvent(asked)!.at });
  if (hired?.status === 'in_progress') return make('in_progress', { label: `${Noun} en curso`, screen: 'tracking', threadId: hired.id, at: hired.updatedAt });
  if (hired?.status === 'confirmed') {
    const a = hired.appointment;
    if (a?.confirmed) return make('appointment_confirmed', { label: 'Cita confirmada', screen: 'tracking', threadId: hired.id, at: a.confirmed.confirmedAt });
    return make('waiting_confirmation', { label: 'Esperando confirmación', screen: 'appointment', threadId: hired.id, at: a?.pending?.at ?? hired.updatedAt });
  }
  const created = threads.map((r) => r.createdAt).sort()[0]!;
  if (threads.some((r) => r.status === 'awaiting_proposal')) return make('waiting_quotes', { label: 'Esperando presupuestos', screen: 'status', at: created });
  return make('searching', { label: 'Buscando mecánicos', screen: 'status', at: created });
}

/**
 * The cyclist's active requests, most important first: in motion (searching, quotes, booked)
 * plus the ones every mechanic declined lately (they need the cyclist to invite others).
 */
export function hubItems(requests: ServiceRequest[], now = new Date()): HubItem[] {
  return groupCases(requests)
    .filter(({ threads }) => ['searching', 'proposals_received', 'booked'].includes(caseStatus(threads)) || !!declinedRecently(threads, now))
    .map(({ caseId, threads }) => {
      const quick = getRequestQuickAction(threads, now);
      const updatedAt = threads.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), '');
      return {
        caseId,
        threads,
        lead: leadThread(threads),
        label: quick.label,
        action: quick.action,
        priority: quick.priority,
        order: quick.order,
        deadline: quick.deadline,
        at: quick.at,
        pending: quick.requiresAction,
        quick,
        updatedAt,
      };
    })
    .sort(compareRanked);
}

export type HubState = { kind: 'empty' } | { kind: 'single'; item: HubItem } | { kind: 'multiple'; count: number; pending: number; top: HubItem };

/** The collapsed control: a +, or the most important request plus how many others are active. */
export function hubState(items: HubItem[]): HubState {
  if (items.length === 0) return { kind: 'empty' };
  if (items.length === 1) return { kind: 'single', item: items[0]! };
  return { kind: 'multiple', count: items.length, pending: items.filter((i) => i.pending).length, top: items[0]! };
}
