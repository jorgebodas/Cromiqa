// The Request Hub: what the cyclist's floating control says about their active requests.
// Everything is derived from the stored invitations (no invented progress), one item per
// request, the ones that need the cyclist first.
import type { ID, ServiceRequest } from '../types';
import { formatDate } from '../utils';
import { caseStatus, groupCases, leadThread } from './cases';
import { currentProposal, openIncident } from './requests';

/** Lower = more urgent. 1–4 need the cyclist; 5–6 are just status. */
export type HubPriority = 1 | 2 | 3 | 4 | 5 | 6;

export interface HubItem {
  caseId: ID;
  threads: ServiceRequest[];
  /** The invitation that best represents the request (hired, best quote, newest). */
  lead: ServiceRequest;
  /** Short status for the chip: "2 presupuestos", "Confirmar cita"… */
  label: string;
  /** What to do, in a few words, when the cyclist has to act. */
  action?: string;
  priority: HubPriority;
  pending: boolean;
  /** The next meaningful action and where the hub opens it. */
  quick: QuickAction;
  updatedAt: string;
}

const short = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' }).replace('.', '');

/** Where the hub opens a request: the screen for its next meaningful action. */
export type QuickScreen = 'compare' | 'appointment' | 'completion' | 'incident' | 'tracking' | 'status';

export interface QuickAction {
  /** Short status for the chip. */
  label: string;
  /** The same status in one word, for the collapsed pill: "Presupuestos", "Confirmar"… */
  word: string;
  /** How far along the request is (0–1), drawn as the ring around its circle. */
  progress: number;
  /** What to do, in a few words, when the cyclist has to act. */
  action?: string;
  screen: QuickScreen;
  /** The invitation the screen is about (the hired one, or the lead). */
  threadId: ID;
  priority: HubPriority;
  requiresAction: boolean;
}

/**
 * The one place that decides a request's next meaningful action: label, destination and
 * urgency. Used by the collapsed chip and by the hub panel alike. It only points to a screen;
 * nothing is accepted, confirmed or closed on the cyclist's behalf.
 */
export function getRequestQuickAction(threads: ServiceRequest[]): QuickAction {
  const lead = leadThread(threads);
  const make = (q: Omit<QuickAction, 'requiresAction' | 'threadId'> & { threadId?: ID }): QuickAction => ({
    ...q,
    threadId: q.threadId ?? lead.id,
    requiresAction: q.priority <= 4,
  });
  const hired = threads.find((r) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status));
  if (hired?.status === 'awaiting_completion' && openIncident(hired))
    return make({ label: 'Incidencia abierta', word: 'Incidencia', progress: 0.9, action: 'Sigue el problema con el mecánico', screen: 'incident', threadId: hired.id, priority: 1 });
  const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
  if (quotes.length)
    return make({ label: quotes.length === 1 ? '1 presupuesto' : `${quotes.length} presupuestos`, word: quotes.length === 1 ? 'Revisar' : 'Elegir', progress: 0.4, action: quotes.length === 1 ? 'Revisa el presupuesto' : 'Compara y elige uno', screen: 'compare', priority: 2 });
  const asked = threads.find((r) => r.status === 'awaiting_proposal' && r.openProposal && r.events[r.events.length - 1]?.by === 'mechanic');
  if (asked) return make({ label: 'Te han escrito', word: 'Responder', progress: 0.3, action: 'Responde al mecánico', screen: 'status', threadId: asked.id, priority: 2 });
  if (hired?.status === 'confirmed') {
    const a = hired.appointment;
    if (a?.pending?.by === 'mechanic') return make({ label: 'Confirmar cita', word: 'Confirmar', progress: 0.55, action: 'Confirma la fecha propuesta', screen: 'appointment', threadId: hired.id, priority: 3 });
    if (!a?.confirmed && !a?.pending) return make({ label: 'Proponer cita', word: 'Agendar', progress: 0.55, action: 'Propón una fecha', screen: 'appointment', threadId: hired.id, priority: 3 });
    if (a?.confirmed) return make({ label: `Cita ${short(a.confirmed.date)}`, word: 'Agendada', progress: 0.65, screen: 'tracking', threadId: hired.id, priority: 5 });
    return make({ label: 'Cita propuesta', word: 'Esperando', progress: 0.55, screen: 'appointment', threadId: hired.id, priority: 5 });
  }
  if (hired?.status === 'awaiting_completion')
    return make({ label: 'Confirmar servicio', word: 'Confirmar', progress: 0.9, action: 'Confirma que está terminado', screen: 'completion', threadId: hired.id, priority: 4 });
  if (hired?.status === 'in_progress') return make({ label: 'En curso', word: 'Trabajando', progress: 0.75, screen: 'tracking', threadId: hired.id, priority: 5 });
  return make({ label: 'Esperando respuesta', word: 'Esperando', progress: 0.2, screen: 'status', priority: 6 });
}

/** Active requests (not completed, withdrawn or without any available mechanic), most urgent first. */
export function hubItems(requests: ServiceRequest[]): HubItem[] {
  return groupCases(requests)
    .filter((c) => ['searching', 'proposals_received', 'booked'].includes(caseStatus(c.threads)))
    .map(({ caseId, threads }) => {
      const quick = getRequestQuickAction(threads);
      const updatedAt = threads.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), '');
      return { caseId, threads, lead: leadThread(threads), label: quick.label, action: quick.action, priority: quick.priority, pending: quick.requiresAction, quick, updatedAt };
    })
    .sort((a, b) => a.priority - b.priority || b.updatedAt.localeCompare(a.updatedAt));
}

export type HubState = { kind: 'empty' } | { kind: 'single'; item: HubItem } | { kind: 'multiple'; count: number; pending: number; top: HubItem };

/** The collapsed control: a +, one request's status, or a count with how many need you. */
export function hubState(items: HubItem[]): HubState {
  if (items.length === 0) return { kind: 'empty' };
  if (items.length === 1) return { kind: 'single', item: items[0]! };
  return { kind: 'multiple', count: items.length, pending: items.filter((i) => i.pending).length, top: items[0]! };
}
