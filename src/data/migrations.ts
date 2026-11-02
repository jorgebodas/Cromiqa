// Migrations of the demo database stored in the browser.
import type { DemoDatabase } from '@/domain/types';
import { backfillPendingActions } from '@/domain/logic/pendingActions';

/**
 * v11 · One request = one mechanic. Invitations that shared a request become independent
 * requests (each keeps its own status, quote, chat and history); their pending decisions move
 * with them, and any decision now owed per request is created.
 */
export function splitRequestsPerMechanic(db: DemoDatabase, now = new Date()): DemoDatabase {
  const requests = db.requests.map((r) => (r.caseId === r.id ? r : { ...r, caseId: r.id }));
  const pendingActions = (db.pendingActions ?? []).map((a) =>
    a.requestId === a.threadId ? a : { ...a, requestId: a.threadId, key: a.type === 'quote_decision' ? `quote:${a.threadId}` : a.key },
  );
  return backfillPendingActions({ ...db, requests, pendingActions }, now);
}
