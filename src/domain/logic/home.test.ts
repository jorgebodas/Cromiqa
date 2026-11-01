import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { ServiceRequest } from '@/domain/types';
import { cyclistAttention, cyclistInProgress, cyclistPendingActions, mechanicAttention, mechanicCounts, profileGaps, profileStatus, upcomingAppointments } from './home';
import { applyRequestAction, currentProposal } from './requests';

const now = new Date('2026-10-17T10:00:00');
const db = createSeed(now);
const forOwner = (id: string) => db.requests.filter((r) => r.ownerId === id);
const forMechanic = (id: string) => db.requests.filter((r) => r.mechanicId === id);

describe('cyclist home', () => {
  it('puts proposals waiting for an answer first, and only real ones', () => {
    for (const owner of db.users.filter((u) => u.role === 'owner')) {
      const items = cyclistAttention(forOwner(owner.id), db.reviews, now);
      const proposals = items.filter((i) => i.kind === 'proposal');
      for (const p of proposals) {
        expect(p.request.status).toBe('proposal_received');
        expect(currentProposal(p.request)?.status).toBe('pending');
      }
      // Quotes come first unless something more pressing (incident, confirmation, date) is waiting.
      if (proposals.length) expect(['incident', 'confirm', 'appointment', 'proposal']).toContain(items[0]!.kind);
    }
  });

  it('asks for a review only for completed services without one', () => {
    const items = db.users.flatMap((u) => cyclistAttention(forOwner(u.id), db.reviews, now)).filter((i) => i.kind === 'review');
    for (const i of items) {
      expect(i.request.status).toBe('completed');
      expect(db.reviews.some((r) => r.requestId === i.request.id)).toBe(false);
    }
  });

  it('shows nothing for an account with no activity', () => {
    expect(cyclistAttention([], db.reviews, now)).toEqual([]);
    expect(cyclistInProgress([])).toEqual([]);
  });

  it('lists in-progress work without the items that need the cyclist', () => {
    const list = cyclistInProgress(db.requests);
    expect(list.every((r) => ['sent', 'awaiting_proposal', 'confirmed', 'in_progress', 'awaiting_completion'].includes(r.status))).toBe(true);
  });
});

describe('mechanic home', () => {
  it('orders the to-do list by urgency: new invitations first', () => {
    const rank = { respond: 0, message: 1, incident: 1, propose: 2, appointment: 3, start: 4, finish: 5 };
    for (const m of db.mechanics) {
      const kinds = mechanicAttention(forMechanic(m.id), now).map((i) => rank[i.kind]);
      expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
    }
  });

  it('only asks to start work on the day of the appointment or later', () => {
    const r = forMechanic('m-carlos').find((x) => x.status === 'confirmed');
    if (!r) return;
    const date = currentProposal(r)!.date;
    const before = new Date(`${date}T08:00:00`);
    before.setDate(before.getDate() - 1);
    expect(mechanicAttention([r], before).some((i) => i.kind === 'start')).toBe(false);
    expect(mechanicAttention([r], new Date(`${date}T09:00:00`)).some((i) => i.kind === 'start')).toBe(true);
  });

  it('counts unanswered, with appointment and active work from the requests', () => {
    const reqs = forMechanic('m-carlos');
    const c = mechanicCounts(reqs);
    expect(c.unanswered).toBe(reqs.filter((r) => r.status === 'sent' || r.status === 'awaiting_proposal').length);
    expect(c.withAppointment).toBe(reqs.filter((r) => r.status === 'confirmed').length);
    expect(c.active).toBe(reqs.filter((r) => r.status === 'in_progress').length);
  });

  it('flags a client message waiting for a reply', () => {
    const base = forMechanic('m-carlos').find((r) => r.status === 'proposal_received') ?? forMechanic('m-carlos')[0]!;
    const withMessage: ServiceRequest = {
      ...base,
      status: 'proposal_received',
      events: [...base.events, { id: 'e-x', type: 'message', by: 'owner', at: now.toISOString(), text: '¿Podría ser el jueves?' }],
    };
    expect(mechanicAttention([withMessage], now)[0]?.kind).toBe('message');
  });

  it('sorts upcoming appointments by date', () => {
    const list = upcomingAppointments(db.requests);
    const keys = list.map((r) => `${currentProposal(r)!.date}T${currentProposal(r)!.time}`);
    expect(keys).toEqual([...keys].sort());
  });
});

describe('professional profile', () => {
  it('reports what is missing and the resulting status', () => {
    const m = db.mechanics[0]!;
    expect(profileGaps(m)).toEqual([]);
    expect(profileGaps({ ...m, services: [], weeklyAvailability: [] })).toEqual(['services', 'availability']);
    expect(profileStatus({ ...m, services: [] })).toBe('incomplete');
    expect(profileStatus({ ...m, listing: 'pending_verification' })).toBe('pending_verification');
    expect(profileStatus({ ...m, listing: 'active' })).toBe('active');
  });
});

describe('requires user action (P0): what replaces the + with "N pendientes"', () => {
  const quote = (price: number) => ({ price, date: '2026-10-20', time: '10:00', message: 'Ajuste completo.' });
  const mine = (d: typeof db, id: string) => d.requests.filter((r) => r.ownerId === id);
  const kinds = (d: typeof db, ...owners: string[]) => cyclistPendingActions(owners.flatMap((o) => mine(d, o)), now).map((i) => i.kind);

  it('new, waiting and in-progress requests, quotes being prepared and plain messages never count', () => {
    let d = createSeed(now);
    const [a, b] = mine(d, 'u-bea').map((r) => r.id);
    expect(kinds(d, 'u-bea')).toEqual([]); // just sent
    d = applyRequestAction(d, a!, { type: 'accept_for_review' }, 'mechanic', now).db;
    expect(kinds(d, 'u-bea')).toEqual([]); // a mechanic is preparing a quote
    const eva = mine(d, 'u-eva')[0]!.id;
    d = applyRequestAction(d, eva, { type: 'message', text: '¡Empiezo mañana!', by: 'mechanic' }, 'mechanic', now).db;
    expect(kinds(d, 'u-eva')).toEqual([]); // work in progress + a chat message: informational
    // Declines and reviews belong to Home, not to the Hub.
    for (const id of [a!, b!]) d = applyRequestAction(d, id, { type: 'reject_request', reason: 'Sin hueco' }, 'mechanic', now).db;
    expect(cyclistAttention(mine(d, 'u-bea'), [], now).map((i) => i.kind)).toEqual(['declined']);
    expect(kinds(d, 'u-bea')).toEqual([]);
  });

  it('several quotes or questions in one request are one decision each', () => {
    let d = createSeed(now);
    const [a, b] = mine(d, 'u-bea').map((r) => r.id);
    d = applyRequestAction(d, a!, { type: 'send_open_proposal', message: '¿Shimano o SRAM?' }, 'mechanic', now).db;
    d = applyRequestAction(d, b!, { type: 'send_open_proposal', message: '¿Qué año es?' }, 'mechanic', now).db;
    expect(cyclistPendingActions(mine(d, 'u-bea'), now)).toMatchObject([{ kind: 'clarify', count: 2 }]);
    d = applyRequestAction(d, a!, { type: 'send_proposal', proposal: quote(40) }, 'mechanic', now).db;
    d = applyRequestAction(d, b!, { type: 'send_proposal', proposal: quote(55) }, 'mechanic', now).db;
    expect(cyclistPendingActions(mine(d, 'u-bea'), now)).toMatchObject([{ kind: 'proposal', count: 2 }]);
  });

  it('independent decisions add up, in priority order, and resolving one updates the count at once', () => {
    let d = createSeed(now);
    // Incidents · dates · quotes · completion (one cyclist per state in the demo).
    expect(kinds(d, 'u-fran', 'u-carla', 'u-dani', 'u-gema')).toEqual(['incident', 'appointment', 'proposal', 'confirm']);
    expect(kinds(d, 'u-carla', 'u-dani')).toHaveLength(2);
    const dani = mine(d, 'u-dani').find((r) => r.status === 'confirmed')!.id;
    d = applyRequestAction(d, dani, { type: 'confirm_appointment' }, 'owner', now).db;
    expect(kinds(d, 'u-carla', 'u-dani')).toEqual(['proposal']);
    const fran = mine(d, 'u-fran')[0]!.id;
    d = applyRequestAction(d, fran, { type: 'confirm_completion' }, 'owner', now).db;
    expect(kinds(d, 'u-fran')).toEqual([]); // all resolved: the + is back
  });
});
