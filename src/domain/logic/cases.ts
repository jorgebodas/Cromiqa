// The cyclist's request ("case") is the group of invitations sent for it. Its status and the
// recovery suggestions are derived from the invitations, never stored separately.
import type { ID, ServiceRequest } from '../types';
import { currentProposal, isHired } from './requests';

export type CaseStatus = 'searching' | 'proposals_received' | 'booked' | 'completed' | 'canceled' | 'unavailable';

const HOUR = 60 * 60 * 1000;

/** Hypotheses, not promises: when to suggest inviting more providers. Configurable. */
export const RECOVERY_HOURS = { noResponse: 4, noQuote: 24 } as const;

export function caseStatus(threads: ServiceRequest[]): CaseStatus {
  if (threads.some((r) => r.status === 'completed')) return 'completed';
  if (threads.some(isHired) && threads.some((r) => r.status === 'confirmed' || r.status === 'in_progress')) return 'booked';
  if (threads.some((r) => r.status === 'proposal_received' || (r.openProposal && r.status === 'awaiting_proposal'))) return 'proposals_received';
  if (threads.some((r) => r.status === 'sent' || r.status === 'awaiting_proposal')) return 'searching';
  if (threads.some((r) => r.events.some((e) => e.type === 'cancelled_by_owner'))) return 'canceled';
  return 'unavailable';
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  searching: 'Esperando respuestas',
  proposals_received: 'Propuestas recibidas',
  booked: 'Servicio contratado',
  completed: 'Completada',
  canceled: 'Retirada',
  unavailable: 'Sin mecánico disponible',
};

/** Group invitations into cases, most recently active first. */
export function groupCases(requests: ServiceRequest[]): { caseId: ID; threads: ServiceRequest[] }[] {
  const map = new Map<ID, ServiceRequest[]>();
  for (const r of requests) map.set(r.caseId, [...(map.get(r.caseId) ?? []), r]);
  const latest = (t: ServiceRequest[]) => t.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), '');
  return [...map.entries()].map(([caseId, threads]) => ({ caseId, threads })).sort((a, b) => latest(b.threads).localeCompare(latest(a.threads)));
}

/** The invitation that represents the case: the hired one, else the best quote, else the newest. */
export function leadThread(threads: ServiceRequest[]): ServiceRequest {
  const hired = threads.find(isHired);
  if (hired) return hired;
  const quoted = threads.filter((r) => r.status === 'proposal_received').sort((a, b) => (currentProposal(a)?.price ?? 0) - (currentProposal(b)?.price ?? 0));
  return quoted[0] ?? [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
}

export type RecoveryHint = 'all_declined' | 'no_response' | 'no_quote';

/**
 * When to suggest inviting more providers (never done automatically): right away if every
 * invitation was declined; after a few hours without any response; after a day without a quote.
 */
export function recoveryHint(threads: ServiceRequest[], now = new Date()): RecoveryHint | null {
  const status = caseStatus(threads);
  if (status === 'booked' || status === 'completed' || status === 'canceled') return null;
  const live = threads.filter((r) => !['cancelled', 'not_selected'].includes(r.status));
  if (live.length === 0) return 'all_declined';
  const sentAt = Math.min(...threads.map((r) => new Date(r.createdAt).getTime()));
  const age = now.getTime() - sentAt;
  const responded = live.some((r) => r.status !== 'sent' || r.openProposal);
  if (!responded && age >= RECOVERY_HOURS.noResponse * HOUR) return 'no_response';
  if (!live.some((r) => r.status === 'proposal_received') && age >= RECOVERY_HOURS.noQuote * HOUR) return 'no_quote';
  return null;
}

/** Cyclist-side links: the request hub, and one provider's invitation inside it. */
export const caseHref = (r: Pick<ServiceRequest, 'caseId'>) => `/solicitudes/${r.caseId}`;
export const threadHref = (r: Pick<ServiceRequest, 'caseId' | 'id'>) => `/solicitudes/${r.caseId}/mecanico/${r.id}`;
