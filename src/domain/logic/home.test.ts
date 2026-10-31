import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { ServiceRequest } from '@/domain/types';
import { cyclistAttention, cyclistInProgress, mechanicAttention, mechanicCounts, profileGaps, profileStatus, upcomingAppointments } from './home';
import { currentProposal } from './requests';

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
      if (proposals.length) expect(items[0]!.kind).toBe('proposal');
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
    expect(list.every((r) => ['sent', 'awaiting_proposal', 'confirmed', 'in_progress'].includes(r.status))).toBe(true);
  });
});

describe('mechanic home', () => {
  it('orders the to-do list by urgency: new invitations first', () => {
    const rank = { respond: 0, message: 1, propose: 2, start: 3, finish: 4 };
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
    expect(profileStatus({ ...m, demoVerified: false })).toBe('pending_verification');
    expect(profileStatus({ ...m, demoVerified: true })).toBe('active');
  });
});
