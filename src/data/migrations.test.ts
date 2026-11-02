import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import { backfillPendingActions, openActionsFor } from '@/domain/logic/pendingActions';
import { createRequest } from '@/domain/logic/requests';
import { serviceLabel } from '@/domain/catalog';
import { splitRequestsPerMechanic } from './migrations';

const now = new Date('2026-10-17T10:00:00');

describe('v11 migration: one request = one mechanic', () => {
  it('splits a request shared by two mechanics into two requests, each with its own decision', () => {
    // A v10-style database: Pablo's inspection sent to Carlos (r-03) and Nerea (r-13) as one request.
    const seed = createSeed(now);
    const v10 = backfillPendingActions({ ...seed, pendingActions: [], requests: seed.requests.map((r) => (r.id === 'r-13' ? { ...r, caseId: 'r-03' } : r)) }, now);
    expect(openActionsFor(v10.pendingActions, 'u-pablo').filter((a) => a.type === 'quote_decision')).toHaveLength(1); // one comparison

    const v11 = splitRequestsPerMechanic(v10, now);
    expect(v11.requests.every((r) => r.caseId === r.id)).toBe(true);
    const quotes = openActionsFor(v11.pendingActions, 'u-pablo').filter((a) => a.type === 'quote_decision');
    expect(quotes.map((a) => a.requestId).sort()).toEqual(['r-03', 'r-13']);
    // Nothing is lost: same requests, statuses and quotes.
    expect(v11.requests.map((r) => [r.id, r.status, r.proposals.length])).toEqual(v10.requests.map((r) => [r.id, r.status, r.proposals.length]));
    // Idempotent.
    expect(splitRequestsPerMechanic(v11, now).pendingActions).toEqual(v11.pendingActions);
  });
});

describe('services from Home', () => {
  it('keeps the service picked on the carousel as the request name', () => {
    const { requests } = createRequest(
      createSeed(now),
      { ownerId: 'u-ana', mechanicIds: ['m-carlos'], category: 'repair', topic: 'brakes', description: 'Los frenos chirrían al frenar fuerte.', bikeId: 'b-ana-mtb', bike: { type: 'mtb', brand: 'Orbea', model: 'Occam H30' }, saveBikeToGarage: false, location: 'rivas', mode: 'home', availability: { timeSlots: ['afternoon'], flexible: false } },
      now,
    );
    expect(requests[0]).toMatchObject({ category: 'repair', topic: 'brakes' });
    expect(serviceLabel(requests[0]!)).toBe('Frenos');
    expect(serviceLabel({ category: 'repair' })).toBe('Reparación');
  });
});
