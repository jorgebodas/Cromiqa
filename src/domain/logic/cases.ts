// A request goes to one mechanic (asking another one is another request). Its stage on the
// cyclist's side is derived from it, never stored separately.
import type { ServiceRequest } from '../types';

export type RequestStage = 'searching' | 'proposals_received' | 'booked' | 'completed' | 'canceled' | 'unavailable';

export function requestStage(r: ServiceRequest): RequestStage {
  if (r.status === 'completed') return 'completed';
  if (['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status)) return 'booked';
  if (r.status === 'proposal_received' || (r.openProposal && r.status === 'awaiting_proposal')) return 'proposals_received';
  if (r.status === 'sent' || r.status === 'awaiting_proposal') return 'searching';
  if (r.events.some((e) => e.type === 'cancelled_by_owner')) return 'canceled';
  return 'unavailable';
}

export const REQUEST_STAGE_LABEL: Record<RequestStage, string> = {
  searching: 'Esperando respuesta',
  proposals_received: 'Propuesta recibida',
  booked: 'Servicio contratado',
  completed: 'Completada',
  canceled: 'Retirada',
  unavailable: 'Sin mecánico disponible',
};

/** Most recently active first. */
export const byLatest = (a: ServiceRequest, b: ServiceRequest) => b.updatedAt.localeCompare(a.updatedAt);

/** The cyclist's page for a request (with its mechanic). */
export const requestHref = (r: Pick<ServiceRequest, 'id'>) => `/solicitudes/${r.id}`;
