import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { DemoDatabase, Role } from '../types';
import { applyRequestAction, createRequest, runScheduledTransitions, type RequestAction } from './requests';
import { backfillPendingActions, openActionsFor, syncPendingActions } from './pendingActions';
import { attentionFromActions } from './home';

const now = new Date('2026-10-17T10:00:00');
const at = (h: number) => new Date(now.getTime() + h * 3600_000);
const quote = (price: number) => ({ price, date: '2026-10-22', time: '10:00', message: 'Ajuste completo.' });

/** The Hub's count for a cyclist: their unresolved PendingActions. */
const hub = (db: DemoDatabase, userId: string) => openActionsFor(db.pendingActions, userId);
const all = (db: DemoDatabase, caseId: string) => db.pendingActions.filter((a) => a.requestId === caseId);

describe('PendingAction lifecycle: one request from start to finish', () => {
  it('creates, keeps and resolves each decision only on the matching event', () => {
    let db = createSeed(now);
    const act = (id: string, action: RequestAction, by: Role, when = now) => {
      db = applyRequestAction(db, id, action, by, when).db;
    };
    const [a, b] = db.requests.filter((r) => r.ownerId === 'u-bea').map((r) => r.id) as [string, string];
    const caseId = 'r-bea-0';

    // 1. Request created (and just waiting): nothing owed, the + stays.
    expect(hub(db, 'u-bea')).toEqual([]);
    // A mechanic preparing a quote is not a decision either.
    act(a, { type: 'accept_for_review' }, 'mechanic');
    expect(hub(db, 'u-bea')).toEqual([]);

    // 2. Two quotes: one comparison decision.
    act(a, { type: 'send_proposal', proposal: quote(40) }, 'mechanic');
    act(b, { type: 'send_proposal', proposal: quote(55) }, 'mechanic');
    expect(hub(db, 'u-bea')).toMatchObject([{ type: 'quote_decision', requestId: caseId, status: 'pending', priority: 3 }]);
    expect(attentionFromActions(db, 'u-bea', now)[0]).toMatchObject({ kind: 'proposal', count: 2 });

    // 3. Opening the quotes changes nothing: re-syncing without an event keeps the same record.
    const before = db.pendingActions;
    expect(syncPendingActions(db, [caseId], { type: 'migration' }, at(1)).pendingActions).toBe(before);

    // 4. Accepting one resolves the decision; the other invitation is not selected.
    act(a, { type: 'accept_proposal' }, 'owner');
    expect(all(db, caseId).find((x) => x.type === 'quote_decision')).toMatchObject({ status: 'resolved', resolutionReason: 'quote_accepted' });
    expect(db.requests.find((r) => r.id === b)!.status).toBe('not_selected');
    // (Hiring confirms price and scope, not the date: the quote's date becomes the mechanic's
    // first proposal, so a date confirmation is owed straight away.)
    expect(hub(db, 'u-bea').map((x) => x.type)).toEqual(['appointment_confirmation']);

    // 5. The mechanic proposes another date: the old date decision is superseded, not duplicated.
    const firstDate = hub(db, 'u-bea')[0]!;
    act(a, { type: 'propose_appointment', slot: { date: '2026-10-23', time: '18:00' } }, 'mechanic', at(1));
    const secondDate = hub(db, 'u-bea')[0]!;
    expect(hub(db, 'u-bea')).toHaveLength(1);
    expect(db.pendingActions.find((x) => x.id === firstDate.id)).toMatchObject({ status: 'superseded', supersededByActionId: secondDate.id });

    // 6. Confirming the date resolves it: back to the +.
    act(a, { type: 'confirm_appointment' }, 'owner', at(1));
    expect(db.pendingActions.find((x) => x.id === secondDate.id)).toMatchObject({ status: 'resolved', resolutionReason: 'appointment_confirmed' });
    expect(hub(db, 'u-bea')).toEqual([]);

    // 7. The repair starts: nothing for the cyclist.
    act(a, { type: 'start' }, 'mechanic');
    expect(hub(db, 'u-bea')).toEqual([]);

    // 8. Marked finished: a service confirmation, with the 72 h closure as its deadline.
    act(a, { type: 'finish_work' }, 'mechanic');
    const confirmation = hub(db, 'u-bea')[0]!;
    expect(confirmation).toMatchObject({ type: 'service_confirmation', priority: 5 });
    expect(confirmation.dueAt).toBe(new Date(now.getTime() + 72 * 3600_000).toISOString());

    // 9. Confirming resolves it.
    const confirmed = applyRequestAction(db, a, { type: 'confirm_completion' }, 'owner', now).db;
    expect(confirmed.pendingActions.find((x) => x.id === confirmation.id)).toMatchObject({ status: 'resolved', resolutionReason: 'service_confirmed' });
    expect(hub(confirmed, 'u-bea')).toEqual([]);

    // 10. Or reporting a problem: the confirmation resolves and the mechanic owes a response.
    act(a, { type: 'report_problem', text: 'Sigue saltando el cambio.' }, 'owner');
    expect(db.pendingActions.find((x) => x.id === confirmation.id)).toMatchObject({ status: 'resolved', resolutionReason: 'problem_reported' });
    const mechanicUser = db.users.find((u) => u.mechanicId === db.requests.find((r) => r.id === a)!.mechanicId)!.id;
    expect(hub(db, mechanicUser)).toMatchObject([{ type: 'incident_response', priority: 1 }]);
    expect(hub(db, 'u-bea')).toEqual([]); // nothing for the cyclist until the mechanic answers
    act(a, { type: 'message', text: 'Lo reviso mañana sin coste.', by: 'mechanic' }, 'mechanic', at(0.5));
    expect(hub(db, mechanicUser)).toEqual([]);
    expect(hub(db, 'u-bea')).toMatchObject([{ type: 'incident_response' }]);
    // A generic message from the cyclist doesn't resolve it.
    act(a, { type: 'message', text: 'Vale, gracias.', by: 'owner' }, 'owner', at(1));
    expect(hub(db, 'u-bea')).toMatchObject([{ type: 'incident_response' }]);

    // 11. Formal resolution resolves every incident action; the work is again to be confirmed.
    act(a, { type: 'resolve_incident' }, 'owner', at(2));
    expect(all(db, caseId).filter((x) => x.type === 'incident_response').every((x) => x.status === 'resolved')).toBe(true);
    expect(all(db, caseId).filter((x) => x.type === 'incident_response').map((x) => x.resolutionReason)).toContain('incident_resolved');
    expect(hub(db, 'u-bea').map((x) => x.type)).toEqual(['service_confirmation']);

    // History is kept: nothing is deleted.
    expect(all(db, caseId).length).toBeGreaterThanOrEqual(7);
  });

  it('a request just created owes nothing (the count is unchanged)', () => {
    const db = createSeed(now);
    const before = hub(db, 'u-ana').length;
    const { db: next, requests } = createRequest(
      db,
      { ownerId: 'u-ana', mechanicIds: ['m-carlos'], category: 'repair', description: 'Los cambios saltan al subir y la cadena hace ruido.', bikeId: 'b-ana-mtb', bike: { type: 'mtb', brand: 'Orbea', model: 'Occam H30' }, saveBikeToGarage: false, location: 'rivas', mode: 'home', availability: { timeSlots: ['afternoon'], flexible: false } },
      now,
    );
    expect(requests).toHaveLength(1);
    expect(hub(next, 'u-ana')).toHaveLength(before);
    expect(next.pendingActions.filter((x) => x.requestId === requests[0]!.caseId)).toEqual([]);
  });

  it('12. a generic chat message creates nothing; a specific information request does, until answered', () => {
    let db = createSeed(now);
    const eva = db.requests.find((r) => r.ownerId === 'u-eva')!;
    db = applyRequestAction(db, eva.id, { type: 'message', text: '¡Empiezo mañana!', by: 'mechanic' }, 'mechanic', now).db;
    expect(hub(db, 'u-eva')).toEqual([]);

    const [a] = db.requests.filter((r) => r.ownerId === 'u-bea');
    db = applyRequestAction(db, a!.id, { type: 'send_open_proposal', message: '¿Es Shimano o SRAM el cambio?' }, 'mechanic', now).db;
    expect(hub(db, 'u-bea')).toMatchObject([{ type: 'information_required', priority: 4 }]);
    db = applyRequestAction(db, a!.id, { type: 'message', text: 'Es Shimano Deore.', by: 'owner' }, 'owner', at(1)).db;
    expect(hub(db, 'u-bea')).toEqual([]);
    expect(db.pendingActions.find((x) => x.type === 'information_required')).toMatchObject({ status: 'resolved', resolutionReason: 'information_sent' });
    // A later generic message from the mechanic doesn't bring it back.
    db = applyRequestAction(db, a!.id, { type: 'message', text: 'Perfecto, te paso precio.', by: 'mechanic' }, 'mechanic', at(2)).db;
    expect(hub(db, 'u-bea')).toEqual([]);
  });

  it('13. the same event twice never duplicates an action', () => {
    const db = createSeed(now);
    const once = syncPendingActions(db, db.requests.map((r) => r.caseId), { type: 'migration' }, now);
    const twice = syncPendingActions(once, db.requests.map((r) => r.caseId), { type: 'migration' }, now);
    expect(twice.pendingActions).toEqual(db.pendingActions);
    const keys = twice.pendingActions.filter((a) => a.status === 'pending').map((a) => `${a.userId}|${a.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('14. a revised quote supersedes the old decision', () => {
    let db = createSeed(now);
    const carla = db.requests.find((r) => r.ownerId === 'u-carla' && r.status === 'proposal_received')!;
    const old = hub(db, 'u-carla')[0]!;
    db = applyRequestAction(db, carla.id, { type: 'revise_proposal', proposal: quote(30) }, 'mechanic', now).db;
    const current = hub(db, 'u-carla');
    expect(current).toHaveLength(1);
    expect(current[0]!.id).not.toBe(old.id);
    expect(db.pendingActions.find((x) => x.id === old.id)).toMatchObject({ status: 'superseded', supersededByActionId: current[0]!.id });
  });

  it('15. the 72 h administrative closure ends the decision without counting as the cyclist confirming', () => {
    let db = createSeed(now);
    const fran = hub(db, 'u-fran')[0]!;
    db = runScheduledTransitions(db, at(80));
    const closed = db.requests.find((r) => r.id === fran.threadId)!;
    expect(closed).toMatchObject({ status: 'completed', autoClosed: true });
    expect(closed.events.some((e) => e.type === 'completion_confirmed')).toBe(false);
    expect(db.pendingActions.find((x) => x.id === fran.id)).toMatchObject({ status: 'resolved', resolutionReason: 'administrative_closure' });
    expect(hub(db, 'u-fran')).toEqual([]);
  });

  it('orders by incidents, dates, quotes, information, completion; a real deadline first within a kind', () => {
    const db = createSeed(now);
    const mixed = { ...db, pendingActions: db.pendingActions.map((a) => ({ ...a, userId: 'u-x' })) };
    const kinds = [...new Set(openActionsFor(mixed.pendingActions, 'u-x').map((a) => a.type))];
    expect(kinds).toEqual(['incident_response', 'appointment_confirmation', 'quote_decision', 'service_confirmation']);
  });

  it('migration: backfilling a v9 database gives the same actions as a fresh seed', () => {
    const fresh = createSeed(now);
    const v9 = { ...fresh, version: 9, pendingActions: undefined } as unknown as DemoDatabase;
    const migrated = backfillPendingActions(v9, now);
    const shape = (d: DemoDatabase) => d.pendingActions.map((a) => [a.userId, a.type, a.status, a.key, a.sourceEntityId]).sort();
    expect(shape(migrated)).toEqual(shape(fresh));
  });
});
