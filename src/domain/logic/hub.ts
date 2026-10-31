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
  /** Short status for the chip: "2 presupuestos", "Cita pendiente"… */
  label: string;
  /** What to do, in a few words, when the cyclist has to act. */
  action?: string;
  priority: HubPriority;
  pending: boolean;
  updatedAt: string;
}

const short = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' }).replace('.', '');

function describe(threads: ServiceRequest[]): Pick<HubItem, 'label' | 'action' | 'priority'> {
  const hired = threads.find((r) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status));
  if (hired?.status === 'awaiting_completion' && openIncident(hired)) return { label: 'Incidencia abierta', action: 'Sigue el problema con el mecánico', priority: 1 };
  const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
  if (quotes.length) return { label: quotes.length === 1 ? '1 presupuesto' : `${quotes.length} presupuestos`, action: quotes.length === 1 ? 'Revisa el presupuesto' : 'Compara y elige uno', priority: 2 };
  const asked = threads.find((r) => r.status === 'awaiting_proposal' && r.openProposal && r.events[r.events.length - 1]?.by === 'mechanic');
  if (asked) return { label: 'Te han escrito', action: 'Responde al mecánico', priority: 2 };
  if (hired?.status === 'confirmed') {
    const a = hired.appointment;
    if (a?.pending?.by === 'mechanic') return { label: 'Cita pendiente', action: 'Confirma la fecha propuesta', priority: 3 };
    if (!a?.confirmed && !a?.pending) return { label: 'Cita pendiente', action: 'Propón una fecha', priority: 3 };
    if (a?.confirmed) return { label: `Cita ${short(a.confirmed.date)}`, priority: 5 };
    return { label: 'Cita propuesta', priority: 5 };
  }
  if (hired?.status === 'awaiting_completion') return { label: 'Confirmar trabajo', action: 'Confirma que está terminado', priority: 4 };
  if (hired?.status === 'in_progress') return { label: 'En curso', priority: 5 };
  return { label: 'Esperando respuesta', priority: 6 };
}

/** Active requests (not completed, withdrawn or without any available mechanic), most urgent first. */
export function hubItems(requests: ServiceRequest[]): HubItem[] {
  return groupCases(requests)
    .filter((c) => ['searching', 'proposals_received', 'booked'].includes(caseStatus(c.threads)))
    .map(({ caseId, threads }) => {
      const d = describe(threads);
      const updatedAt = threads.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), '');
      return { caseId, threads, lead: leadThread(threads), ...d, pending: d.priority <= 4, updatedAt };
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
