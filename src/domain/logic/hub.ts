// The Request Hub: what the cyclist's floating control says about their active requests.
// Everything is derived from the stored requests (no invented progress), one item per request
// (one request = one mechanic), the ones that need the cyclist first.
import type { ServiceRequest } from '../types';
import { requestHref, requestStage } from './cases';
import { autoCloseReminderDue, currentProposal, openIncident } from './requests';

/**
 * Lower = more urgent, by what happens if the cyclist doesn't act:
 * 1 incidents · 2 appointment dates · 3 quotes and choosing a mechanic · 4 information requests ·
 * 5 completion to confirm · 6 waiting on someone else (never above anything that needs the cyclist).
 */
export type HubPriority = 1 | 2 | 3 | 4 | 5 | 6;

/** Every situation a request can be in, from the cyclist's side. All map to stored states. */
export type HubSituation =
  | 'incident' // awaiting_completion with an open incident
  | 'confirm_delivery' // awaiting_completion, the 72 h closure is less than a day away
  | 'work_finished' // awaiting_completion: the mechanic marked the work finished
  | 'new_date' // confirmed: the mechanic proposes a change or answers the cyclist's date
  | 'confirm_appointment' // confirmed: the mechanic proposes the first date
  | 'propose_date' // confirmed: hired, no date proposed yet
  | 'quote' // proposal_received
  | 'choose_mechanic' // the mechanic declined (recently): ask another one with a new request
  | 'message' // awaiting_proposal with the mechanic's last word (open proposal or message)
  | 'in_progress' // in_progress
  | 'appointment_confirmed' // confirmed with an agreed date
  | 'waiting_confirmation' // confirmed: the cyclist proposed a date, the mechanic hasn't answered
  | 'waiting_quotes' // awaiting_proposal: a mechanic is preparing a quote
  | 'searching'; // sent: no mechanic has answered yet

/** Group and order inside the group (waiting states: the most relevant first). */
export const SITUATION_RANK: Record<HubSituation, [HubPriority, number]> = {
  incident: [1, 0],
  confirm_delivery: [5, 0],
  work_finished: [5, 0],
  new_date: [2, 0],
  confirm_appointment: [2, 0],
  propose_date: [2, 0],
  quote: [3, 0],
  choose_mechanic: [3, 1],
  message: [4, 0],
  in_progress: [6, 0],
  appointment_confirmed: [6, 1],
  waiting_confirmation: [6, 2],
  waiting_quotes: [6, 3],
  searching: [6, 4],
};

/** What decides which of two things comes first, shared by the floating hub and Home's "Requiere tu atención". */
export interface Ranked {
  priority: number;
  order?: number;
  /** A real deadline is close (the 72 h closure). Never invented. */
  deadline?: boolean;
  /** Since when it has been waiting: the oldest pending action goes first. */
  at: string;
  /** Last, stable tie-break (the request id), so every list orders equal items the same way. */
  id?: string;
}

/** Priority, then a real deadline, then the oldest pending action. Stable for equal items. */
export function compareRanked(a: Ranked, b: Ranked): number {
  return a.priority - b.priority || (a.order ?? 0) - (b.order ?? 0) || Number(!!b.deadline) - Number(!!a.deadline) || a.at.localeCompare(b.at) || (a.id ?? '').localeCompare(b.id ?? '');
}

export interface HubItem extends Ranked {
  request: ServiceRequest;
  /** The chip's message: "Nuevo presupuesto recibido", "Nueva fecha propuesta"… */
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
  /** Opened directly instead of the hub panel (the request page). */
  href?: string;
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

/** The mechanic declined the request in the last week: the cyclist may ask another one. */
export function declinedRecently(r: ServiceRequest, now = new Date()): string | undefined {
  const last = lastEvent(r);
  return r.status === 'cancelled' && last?.type === 'rejected_by_mechanic' && now.getTime() - new Date(last.at).getTime() < 7 * DAY ? last.at : undefined;
}

/**
 * The one place that decides a request's situation: its message, destination and priority.
 * Used by the desktop chip and (through the same ranking) Home. It only points to a screen;
 * nothing is accepted, confirmed or closed on the cyclist's behalf.
 */
export function getRequestQuickAction(r: ServiceRequest, now = new Date()): QuickAction {
  const [noun, Noun, done] = SERVICE_NOUN[r.category];
  const make = (situation: HubSituation, q: { label: string; action?: string; screen: QuickScreen; href?: string; at: string; deadline?: boolean }): QuickAction => {
    const [priority, order] = SITUATION_RANK[situation];
    return { situation, ...q, priority, order, requiresAction: priority <= 5 };
  };
  if (r.status === 'awaiting_completion') {
    const incident = openIncident(r);
    if (incident) return make('incident', { label: 'Incidencia pendiente', action: 'Sigue el problema con el mecánico', screen: 'incident', at: incident.openedAt });
    const at = r.finishedAt ?? r.updatedAt;
    if (autoCloseReminderDue(r, now)) return make('confirm_delivery', { label: 'Confirma la entrega', action: 'Se cerrará sola en menos de 24 h', screen: 'completion', at, deadline: true });
    return make('work_finished', { label: done, action: 'Confirma que está bien o reporta un problema', screen: 'completion', at });
  }
  if (r.status === 'confirmed') {
    const a = r.appointment;
    if (a?.pending?.by === 'mechanic') {
      // A change of an agreed date, or an answer to the cyclist's own proposal: a new date.
      const change = !!a.confirmed || r.events.some((e) => e.type === 'appointment_proposed' && e.by === 'owner');
      return change
        ? make('new_date', { label: 'Nueva fecha propuesta', action: 'Confirma la fecha o propón otra', screen: 'appointment', at: a.pending.at })
        : make('confirm_appointment', { label: 'Confirma tu cita', action: 'Confirma la fecha o propón otra', screen: 'appointment', at: a.pending.at });
    }
    if (!a?.confirmed && !a?.pending) return make('propose_date', { label: `Elige fecha para ${noun}`, action: 'Propón una fecha al mecánico', screen: 'appointment', at: r.updatedAt });
    if (a?.confirmed) return make('appointment_confirmed', { label: 'Cita confirmada', screen: 'tracking', at: a.confirmed.confirmedAt });
    return make('waiting_confirmation', { label: 'Esperando confirmación', screen: 'appointment', at: a?.pending?.at ?? r.updatedAt });
  }
  const quote = r.status === 'proposal_received' ? currentProposal(r) : undefined;
  if (quote?.status === 'pending') return make('quote', { label: 'Nuevo presupuesto recibido', action: 'Revisa el presupuesto', screen: 'compare', at: quote.createdAt });
  const declinedAt = declinedRecently(r, now);
  if (declinedAt) return make('choose_mechanic', { label: 'Busca otro mecánico', action: 'Pide el servicio a otro mecánico', screen: 'status', href: requestHref(r), at: declinedAt });
  if (r.status === 'awaiting_proposal' && r.openProposal && lastEvent(r)?.by === 'mechanic')
    return make('message', { label: 'Nuevo mensaje del mecánico', action: 'Responde al mecánico', screen: 'status', href: requestHref(r), at: lastEvent(r)!.at });
  if (r.status === 'in_progress') return make('in_progress', { label: `${Noun} en curso`, screen: 'tracking', at: r.updatedAt });
  if (r.status === 'awaiting_proposal') return make('waiting_quotes', { label: 'Esperando presupuesto', screen: 'status', at: r.createdAt });
  return make('searching', { label: 'Esperando respuesta', screen: 'status', at: r.createdAt });
}

/**
 * The cyclist's active requests, most important first: in motion (waiting, quote, booked) plus
 * the ones the mechanic declined lately (the cyclist may ask another mechanic).
 */
export function hubItems(requests: ServiceRequest[], now = new Date()): HubItem[] {
  return requests
    .filter((r) => ['searching', 'proposals_received', 'booked'].includes(requestStage(r)) || !!declinedRecently(r, now))
    .map((request) => {
      const quick = getRequestQuickAction(request, now);
      return {
        request,
        label: quick.label,
        action: quick.action,
        priority: quick.priority,
        order: quick.order,
        deadline: quick.deadline,
        at: quick.at,
        id: request.id,
        pending: quick.requiresAction,
        quick,
        updatedAt: request.updatedAt,
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
