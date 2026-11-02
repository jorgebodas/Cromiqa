// Migrations of the demo database stored in the browser.
import type { DemoDatabase, PendingAction, ServiceRequest } from '@/domain/types';
import { backfillPendingActions } from '@/domain/logic/pendingActions';

/** Shapes older versions stored (v9–v11): requests grouped in "cases", invitations not selected. */
type Legacy = Omit<ServiceRequest, 'status' | 'proposals' | 'events'> & {
  caseId?: string;
  status: ServiceRequest['status'] | 'not_selected';
  proposals: (Omit<ServiceRequest['proposals'][number], 'status'> & { status: ServiceRequest['proposals'][number]['status'] | 'not_selected' })[];
  events: (Omit<ServiceRequest['events'][number], 'type'> & { type: ServiceRequest['events'][number]['type'] | 'not_selected' })[];
};
type LegacyAction = PendingAction & { threadId?: string };

/**
 * v12 · One request = one mechanic, in the model itself. Older data grouped invitations to
 * several mechanics in one request; each becomes its own request (same id, status, quote, chat
 * and history). An invitation closed because another mechanic was hired becomes a cancelled
 * request (its quote no longer valid). Pending decisions follow their request, and anything now
 * owed is created. Idempotent; nothing is deleted.
 */
export function toOneMechanicPerRequest(db: DemoDatabase, now = new Date()): DemoDatabase {
  const requests = (db.requests as unknown as Legacy[]).map(({ caseId: _case, ...r }) => {
    if (r.status !== 'not_selected' && !r.proposals.some((p) => p.status === 'not_selected') && !r.events.some((e) => e.type === 'not_selected'))
      return r as ServiceRequest;
    return {
      ...r,
      status: r.status === 'not_selected' ? 'cancelled' : r.status,
      proposals: r.proposals.map((p) => (p.status === 'not_selected' ? { ...p, status: 'withdrawn' as const } : p)),
      events: r.events.map((e) => (e.type === 'not_selected' ? { ...e, type: 'cancelled_by_owner' as const, text: 'Contrataste a otro mecánico para este servicio.' } : e)),
    } as ServiceRequest;
  });
  const pendingActions = ((db.pendingActions ?? []) as LegacyAction[]).map(({ threadId, ...a }) => {
    const requestId = threadId ?? a.requestId;
    return { ...a, requestId, key: a.type === 'quote_decision' ? `quote:${requestId}` : a.key } as PendingAction;
  });
  return backfillPendingActions({ ...db, requests, pendingActions }, now);
}
