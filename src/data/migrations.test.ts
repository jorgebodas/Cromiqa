import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { DemoDatabase } from '@/domain/types';
import { openActionsFor } from '@/domain/logic/pendingActions';
import { createRequest } from '@/domain/logic/requests';
import { serviceLabel } from '@/domain/catalog';
import { toOneMechanicPerRequest } from './migrations';

const now = new Date('2026-10-17T10:00:00');

describe('v12 migration: one request = one mechanic, in the model', () => {
  it('turns grouped invitations into independent requests and drops "not selected"', () => {
    // A v11-style database: Pablo's inspection sent to Carlos (r-03) and Nerea (r-13) as one case;
    // Bea's first request had a third invitation closed because she hired someone else.
    const seed = createSeed(now);
    const bea = seed.requests.find((r) => r.ownerId === 'u-bea')!;
    const legacy = {
      ...seed,
      version: 11,
      requests: seed.requests.map((r) => {
        const caseId = r.id === 'r-13' ? 'r-03' : r.id;
        if (r.id !== bea.id) return { ...r, caseId };
        return {
          ...r,
          caseId,
          status: 'not_selected',
          proposals: [{ id: 'p-legacy', price: 40, date: '2026-10-20', time: '10:00', message: 'x', status: 'not_selected', createdAt: now.toISOString() }],
          events: [...r.events, { id: 'e-legacy', type: 'not_selected', at: now.toISOString(), by: 'system' }],
        };
      }),
      pendingActions: seed.pendingActions.map((a) => ({ ...a, threadId: a.requestId, requestId: a.requestId === 'r-13' ? 'r-03' : a.requestId })),
    } as unknown as DemoDatabase;

    const v12 = toOneMechanicPerRequest(legacy, now);
    expect(v12.requests.every((r) => !('caseId' in r))).toBe(true);
    const closed = v12.requests.find((r) => r.id === bea.id)!;
    expect(closed.status).toBe('cancelled');
    expect(closed.proposals[0]!.status).toBe('withdrawn');
    expect(closed.events.at(-1)).toMatchObject({ type: 'cancelled_by_owner', text: 'Contrataste a otro mecánico para este servicio.' });
    expect(v12.pendingActions.every((a) => !('threadId' in a))).toBe(true);
    // Each quote decision follows its own request.
    const quotes = openActionsFor(v12.pendingActions, 'u-pablo').filter((a) => a.type === 'quote_decision');
    expect(quotes.map((a) => a.requestId).sort()).toEqual(['r-03', 'r-13']);
    expect(quotes.map((a) => a.key).sort()).toEqual(['quote:r-03', 'quote:r-13']);
    // Nothing is lost and it is idempotent.
    expect(v12.requests.map((r) => r.id)).toEqual(seed.requests.map((r) => r.id));
    expect(toOneMechanicPerRequest(v12, now)).toEqual(v12);
  });
});

describe('services from Home', () => {
  it('keeps the service picked on the carousel as the request name', () => {
    const { request } = createRequest(
      createSeed(now),
      { ownerId: 'u-ana', mechanicId: 'm-carlos', category: 'repair', topic: 'brakes', description: 'Los frenos chirrían al frenar fuerte.', bikeId: 'b-ana-mtb', bike: { type: 'mtb', brand: 'Orbea', model: 'Occam H30' }, saveBikeToGarage: false, location: 'rivas', mode: 'home', availability: { timeSlots: ['afternoon'], flexible: false } },
      now,
    );
    expect(request).toMatchObject({ category: 'repair', topic: 'brakes' });
    expect(serviceLabel(request)).toBe('Frenos');
    expect(serviceLabel({ category: 'repair' })).toBe('Reparación');
  });
});
