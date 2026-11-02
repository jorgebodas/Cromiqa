// PendingAction lifecycle: the decisions a person owes on a request, as their own records.
//
// One place creates, resolves and supersedes them: `syncPendingActions`, called after every
// domain event (`applyRequestAction`, a new request or invitation, the 72 h closure). For the
// request (case) the event touched, it works out which decisions are owed now and reconciles
// the stored records with that: a decision that appears creates an action; one that is no
// longer owed is resolved, with the reason the event gives; one replaced by a newer version
// (a revised quote, another date) is superseded and linked to its successor. Running it twice
// changes nothing (idempotent), and the same decision never has two pending records (`key`).
//
// The Request Hub reads only these records (never request statuses, messages or notifications).
// Opening a screen never resolves anything: only the explicit action or a valid transition does.
import type { DemoDatabase, ID, PendingAction, PendingActionType, Role, ServiceRequest } from '../types';
import { uid } from '../utils';
import { autoCloseAt, currentProposal, openIncident, type RequestAction } from './requests';

/** What triggered a sync: a request action (and who did it), or a system event. */
export type PendingCause = { type: RequestAction['type']; by: Role } | { type: 'request_created' | 'invited' | 'administrative_closure' | 'migration' };

export const ACTION_PRIORITY: Record<PendingActionType, PendingAction['priority']> = {
  incident_response: 1,
  appointment_confirmation: 2,
  quote_decision: 3,
  information_required: 4,
  service_confirmation: 5,
};

type Owed = Pick<PendingAction, 'key' | 'type' | 'userId' | 'requestId' | 'threadId' | 'sourceEntityType' | 'sourceEntityId' | 'createdAt' | 'dueAt'>;

const lastBy = (r: ServiceRequest, by: Role, type: string, after: string) => r.events.some((e) => e.by === by && e.type === type && e.at > after);

/** The decisions owed right now on one request (case), by whom. Pure, from the stored request. */
export function owedActions(db: Pick<DemoDatabase, 'users'>, threads: ServiceRequest[]): Owed[] {
  if (!threads.length) return [];
  const caseId = threads[0]!.caseId;
  const ownerId = threads[0]!.ownerId;
  const mechanicUser = (mechanicId: ID) => db.users.find((u) => u.mechanicId === mechanicId)?.id;
  const owed: Owed[] = [];

  // Quotes: every pending quote of the request is one comparison decision. A revision makes it a
  // new decision (new terms to review), so the version count is part of its source.
  const quotes = threads.filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending');
  if (quotes.length) {
    const revisions = threads.reduce((n, r) => n + r.events.filter((e) => e.type === 'proposal_revised').length, 0);
    const newest = [...quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    owed.push({
      key: `quote:${caseId}`,
      type: 'quote_decision',
      userId: ownerId,
      requestId: caseId,
      threadId: newest.id,
      sourceEntityType: 'proposal',
      sourceEntityId: `${caseId}#v${revisions}`,
      createdAt: quotes.map((r) => currentProposal(r)!.createdAt).sort()[0]!,
    });
  }

  for (const t of threads) {
    // A date the mechanic proposed (first one or a change): the cyclist confirms or counters.
    const p = t.status === 'confirmed' ? t.appointment?.pending : undefined;
    if (p?.by === 'mechanic')
      owed.push({ key: `appointment:${t.id}`, type: 'appointment_confirmation', userId: ownerId, requestId: caseId, threadId: t.id, sourceEntityType: 'appointment', sourceEntityId: `${t.id}@${p.at}:${p.date}T${p.time}`, createdAt: p.at });

    // A mechanic asked for specific information before quoting (open proposal), until the cyclist answers.
    const o = t.status === 'awaiting_proposal' ? t.openProposal : undefined;
    if (o && !lastBy(t, 'owner', 'message', o.createdAt))
      owed.push({ key: `information:${t.id}`, type: 'information_required', userId: ownerId, requestId: caseId, threadId: t.id, sourceEntityType: 'open_proposal', sourceEntityId: `${t.id}@${o.createdAt}`, createdAt: o.createdAt });

    // Incidents live on their own: whatever happens to the request (even a cancellation), the
    // response is owed until the incident is formally resolved. Only the party who has to respond
    // owes something: first the mechanic; once the mechanic has answered, the cyclist (who closes
    // it formally when it's fixed).
    const incident = openIncident(t);
    if (incident) {
      const answered = t.events.find((e) => e.by === 'mechanic' && e.type === 'message' && e.at > incident.openedAt);
      const mech = mechanicUser(t.mechanicId);
      if (!answered && mech)
        owed.push({ key: `incident:${t.id}@${incident.openedAt}:mechanic`, type: 'incident_response', userId: mech, requestId: caseId, threadId: t.id, sourceEntityType: 'incident', sourceEntityId: `${t.id}@${incident.openedAt}`, createdAt: incident.openedAt });
      if (answered)
        owed.push({ key: `incident:${t.id}@${incident.openedAt}:owner`, type: 'incident_response', userId: ownerId, requestId: caseId, threadId: t.id, sourceEntityType: 'incident', sourceEntityId: `${t.id}@${incident.openedAt}`, createdAt: answered.at });
    } else if (t.status === 'awaiting_completion') {
      // Work marked finished (or an incident resolved since): the cyclist confirms or reports a problem.
      const anchor = [t.finishedAt ?? t.updatedAt, ...(t.incidents ?? []).map((i) => i.resolvedAt ?? '')].sort().pop()!;
      owed.push({ key: `service:${t.id}`, type: 'service_confirmation', userId: ownerId, requestId: caseId, threadId: t.id, sourceEntityType: 'completion', sourceEntityId: `${t.id}@${anchor}`, createdAt: anchor, dueAt: autoCloseAt(t)?.toISOString() });
    }
  }
  return owed;
}

/** Events that cancel the request (or an invitation of it). */
const CANCELLATIONS: ReadonlySet<PendingCause['type']> = new Set(['cancel_by_owner', 'cancel_by_mechanic']);

/** Why an action stopped being owed, from the event that ended it. Never "confirmed" by silence. */
function resolutionReason(cause: PendingCause, a: PendingAction): string {
  switch (cause.type) {
    case 'accept_proposal':
      return a.type === 'quote_decision' ? 'quote_accepted' : 'other_quote_accepted';
    case 'reject_proposal':
      return 'quote_declined';
    case 'send_proposal':
      return a.type === 'information_required' ? 'quote_sent' : 'no_longer_required';
    case 'reject_request':
      return 'withdrawn_by_mechanic';
    case 'cancel_by_owner':
      return 'request_cancelled';
    case 'cancel_by_mechanic':
      return 'cancelled_by_mechanic';
    case 'confirm_appointment':
      return 'appointment_confirmed';
    case 'propose_appointment':
      return cause.by === 'owner' ? 'date_declined_counter_proposed' : 'no_longer_required';
    case 'message':
      return cause.by === 'owner' ? 'information_sent' : 'mechanic_responded';
    case 'confirm_completion':
      return 'service_confirmed';
    case 'report_problem':
      return 'problem_reported';
    case 'resolve_incident':
      return 'incident_resolved';
    case 'administrative_closure':
      // The 72 h closure ends the decision without anyone confirming the work.
      return 'administrative_closure';
    default:
      return 'no_longer_required';
  }
}

/**
 * Reconcile the stored actions of the given requests (cases) with what is owed now. Called by
 * every domain event; idempotent. Never touches other requests.
 */
export function syncPendingActions(db: DemoDatabase, caseIds: Iterable<ID>, cause: PendingCause, now = new Date()): DemoDatabase {
  const at = now.toISOString();
  let actions = db.pendingActions ?? [];
  let changed = false;
  for (const caseId of new Set(caseIds)) {
    const owed = owedActions(db, db.requests.filter((r) => r.caseId === caseId));
    const open = actions.filter((a) => a.requestId === caseId && a.status === 'pending');
    const next: PendingAction[] = [];
    const updates = new Map<ID, PendingAction>();
    for (const o of owed) {
      const current = open.find((a) => a.key === o.key);
      if (current && current.sourceEntityId === o.sourceEntityId) {
        // Same decision: keep it (refresh where it's taken and its deadline).
        if (current.threadId !== o.threadId || current.dueAt !== o.dueAt) updates.set(current.id, { ...current, threadId: o.threadId, dueAt: o.dueAt });
        continue;
      }
      const fresh: PendingAction = { ...o, id: uid('pa'), status: 'pending', priority: ACTION_PRIORITY[o.type] };
      next.push(fresh);
      // A newer version of the same decision (revised quote, another date) supersedes the old one.
      if (current) updates.set(current.id, { ...current, status: 'superseded', resolvedAt: at, resolutionReason: 'superseded', supersededByActionId: fresh.id });
    }
    for (const a of open) {
      if (owed.some((o) => o.key === a.key)) continue;
      // Cancelling the request makes its outstanding decisions moot: superseded (kept for history),
      // not answered. Incident actions never end this way (they're still owed while it's open).
      if (CANCELLATIONS.has(cause.type) && a.type !== 'incident_response')
        updates.set(a.id, { ...a, status: 'superseded', resolvedAt: at, resolutionReason: 'request_cancelled' });
      else updates.set(a.id, { ...a, status: 'resolved', resolvedAt: at, resolutionReason: resolutionReason(cause, a) });
    }
    if (next.length || updates.size) {
      changed = true;
      actions = [...actions.map((a) => updates.get(a.id) ?? a), ...next];
    }
  }
  return changed ? { ...db, pendingActions: actions } : db.pendingActions ? db : { ...db, pendingActions: actions };
}

/** Migration / seeding: build the actions of every request from its stored state. */
export function backfillPendingActions(db: DemoDatabase, now = new Date()): DemoDatabase {
  return syncPendingActions({ ...db, pendingActions: db.pendingActions ?? [] }, db.requests.map((r) => r.caseId), { type: 'migration' }, now);
}

/**
 * One person's unresolved actions, in the order they should be handled: incidents, dates,
 * quotes, information, completion; within each, a real deadline first, then the oldest.
 */
export function openActionsFor(actions: PendingAction[], userId: ID | undefined): PendingAction[] {
  if (!userId) return [];
  return actions
    .filter((a) => a.userId === userId && a.status === 'pending')
    .sort((a, b) => a.priority - b.priority || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.createdAt.localeCompare(b.createdAt) || a.requestId.localeCompare(b.requestId));
}
