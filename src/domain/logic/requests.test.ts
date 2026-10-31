import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { NewRequestInput } from '@/domain/types';
import { addReview, applyRequestAction, canPerform, chatUnlocked, createRequest, DomainError, inviteToCase, validateProposal } from './requests';
import { caseStatus, recoveryHint } from './cases';
import { canTake, matchProviders } from './matching';
import { toISODate, addDays } from '../utils';

const now = new Date('2026-10-17T10:00:00');
const tomorrow = toISODate(addDays(now, 1));

const baseInput = (): NewRequestInput => ({
  ownerId: 'u-ana',
  mechanicIds: ['m-carlos'],
  category: 'repair',
  description: 'Los cambios saltan al subir y la cadena hace ruido.',
  bikeId: 'b-ana-mtb',
  bike: { type: 'mtb', brand: 'Orbea', model: 'Occam H30' },
  saveBikeToGarage: false,
  location: 'rivas',
  mode: 'home',
  availability: { timeSlots: ['afternoon'], flexible: false },
});

describe('seed data', () => {
  it('meets the minimum demo dataset', () => {
    const db = createSeed(now);
    expect(db.mechanics.length).toBeGreaterThanOrEqual(6);
    expect(db.users.filter((u) => u.role === 'owner').length).toBeGreaterThanOrEqual(4);
    expect(db.bikes.length).toBeGreaterThanOrEqual(8);
    expect(db.requests.length).toBeGreaterThanOrEqual(10);
    const statuses = new Set(db.requests.map((r) => r.status));
    for (const s of ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress', 'completed', 'cancelled'])
      expect(statuses.has(s as never)).toBe(true);
    // Referential integrity
    for (const r of db.requests) {
      expect(db.users.some((u) => u.id === r.ownerId)).toBe(true);
      expect(db.mechanics.some((m) => m.id === r.mechanicId)).toBe(true);
      if (r.bikeId) expect(db.bikes.find((b) => b.id === r.bikeId)?.ownerId).toBe(r.ownerId);
    }
  });
});

describe('createRequest', () => {
  it('creates a request in "sent" status with a sequential code', () => {
    const db = createSeed(now);
    const { db: next, requests: [request] } = createRequest(db, baseInput(), now);
    if (!request) throw new Error('no request');
    expect(request.status).toBe('sent');
    expect(request.code).toBe('CRQ-1014');
    expect(next.requests[0]!.id).toBe(request.id);
    expect(request.events[0]!.type).toBe('created');
  });

  it('rejects short descriptions and incompatible modes', () => {
    const db = createSeed(now);
    expect(() => createRequest(db, { ...baseInput(), description: 'ruido' }, now)).toThrow(DomainError);
    // Andrés has no home service
    expect(() => createRequest(db, { ...baseInput(), mechanicIds: ['m-andres'], bikeId: undefined, location: 'madrid-vallecas' }, now)).toThrow(/domicilio/);
    // Javi does not travel to Coslada
    expect(() => createRequest(db, { ...baseInput(), mechanicIds: ['m-javi'], location: 'coslada' }, now)).toThrow(/zona/);
  });

  it('can save a new bike to the garage', () => {
    const db = createSeed(now);
    const {
      db: next,
      requests: [request],
    } = createRequest(
      db,
      { ...baseInput(), bikeId: undefined, bike: { type: 'mtb', brand: 'Giant', model: 'Talon' }, saveBikeToGarage: true },
      now,
    );
    if (!request) throw new Error('no request');
    expect(request.bikeId).toBeDefined();
    expect(next.bikes.find((b) => b.id === request.bikeId)?.ownerId).toBe('u-ana');
  });
});

describe('request lifecycle', () => {
  it('runs sent → completed and writes a maintenance record', () => {
    let db = createSeed(now);
    const created = createRequest(db, baseInput(), now);
    db = created.db;
    const id = created.requests[0]!.id;
    const step = (action: Parameters<typeof applyRequestAction>[2], actor: 'owner' | 'mechanic') => {
      const r = applyRequestAction(db, id, action, actor, now);
      db = r.db;
      return r.request;
    };
    expect(step({ type: 'accept_for_review' }, 'mechanic').status).toBe('awaiting_proposal');
    expect(step({ type: 'send_proposal', proposal: { price: 35, date: tomorrow, time: '18:00', message: 'Ajuste de cambios a domicilio.' } }, 'mechanic').status).toBe('proposal_received');
    expect(step({ type: 'accept_proposal' }, 'owner').status).toBe('confirmed');
    expect(step({ type: 'start' }, 'mechanic').status).toBe('in_progress');
    const done = step({ type: 'complete', summary: 'Cable y funda nuevos.' }, 'mechanic');
    expect(done.status).toBe('completed');
    const record = db.maintenance.find((m) => m.requestId === id);
    expect(record).toMatchObject({ bikeId: 'b-ana-mtb', cost: 35, description: 'Cable y funda nuevos.' });
  });

  it('rejecting a quote closes that invitation only', () => {
    const db = createSeed(now);
    const r = applyRequestAction(db, 'r-03', { type: 'reject_proposal', reason: 'Muy caro' }, 'owner', now);
    expect(r.request.status).toBe('cancelled');
    expect(r.request.proposals[0]!.status).toBe('rejected');
    // The other quote of the same request is untouched and can still be accepted.
    const sibling = r.db.requests.find((x) => x.id === 'r-13')!;
    expect(sibling.status).toBe('proposal_received');
    expect(applyRequestAction(r.db, 'r-13', { type: 'accept_proposal' }, 'owner', now).request.status).toBe('confirmed');
  });

  it('enforces role and status rules', () => {
    const db = createSeed(now);
    const sent = db.requests.find((r) => r.id === 'r-01')!;
    expect(canPerform(sent, 'accept_proposal', 'owner')).toBe(false);
    expect(canPerform(sent, 'accept_for_review', 'owner')).toBe(false);
    expect(canPerform(sent, 'accept_for_review', 'mechanic')).toBe(true);
    expect(() => applyRequestAction(db, 'r-01', { type: 'complete' }, 'mechanic', now)).toThrow(DomainError);
    expect(() => applyRequestAction(db, 'r-05', { type: 'cancel_by_owner' }, 'owner', now)).toThrow(DomainError);
  });

  it('validates proposals', () => {
    expect(validateProposal({ price: 0, date: tomorrow, time: '10:00', message: 'Hola hola' }, now).price).toBeDefined();
    expect(validateProposal({ price: 20, date: '2020-01-01', time: '10:00', message: 'Hola hola' }, now).date).toBeDefined();
    expect(validateProposal({ price: 20, date: tomorrow, time: '', message: 'Hola hola' }, now).time).toBeDefined();
    expect(Object.keys(validateProposal({ price: 20, date: tomorrow, time: '10:00', message: 'Hola hola' }, now))).toHaveLength(0);
  });

  it('accepts one review per completed request', () => {
    const db = createSeed(now);
    // r-12 already has a review in the seed
    expect(() => addReview(db, 'r-12', 'u-diego', { rating: 5, text: 'Genial' }, now)).toThrow(/Ya has valorado/);
    expect(() => addReview(db, 'r-01', 'u-ana', { rating: 5, text: 'Genial' }, now)).toThrow(/completados/);
    const completed = applyRequestAction(db, 'r-09', { type: 'complete' }, 'mechanic', now).db;
    expect(() => addReview(completed, 'r-09', 'u-ana', { rating: 4, text: 'Muy bien' }, now)).toThrow(DomainError);
    const next = addReview(completed, 'r-09', 'u-irene', { rating: 4, text: 'Muy bien' }, now);
    expect(next.reviews.length).toBe(db.reviews.length + 1);
    expect(next.reviews[0]).toMatchObject({ mechanicId: 'm-lucia', authorName: 'Irene M.', rating: 4 });
  });
});

describe('multi-provider requests', () => {
  const quote = (price: number) => ({ price, date: tomorrow, time: '18:00', message: 'Ajuste completo con prueba.' });

  it('sends one request to up to five providers as separate invitations', () => {
    const db = createSeed(now);
    const { requests } = createRequest(db, { ...baseInput(), mechanicIds: ['m-carlos', 'm-nerea', 'm-carlos'] }, now);
    expect(requests.map((r) => r.mechanicId)).toEqual(['m-carlos', 'm-nerea']); // no duplicates
    expect(new Set(requests.map((r) => r.caseId)).size).toBe(1);
    expect(new Set(requests.map((r) => r.code)).size).toBe(2);
    expect(() => createRequest(db, { ...baseInput(), mechanicIds: [] }, now)).toThrow(/al menos un mecánico/);
    const six = ['m-carlos', 'm-nerea', 'm-marta', 'm-lucia', 'm-javi', 'm-andres'];
    expect(() => createRequest(db, { ...baseInput(), mechanicIds: six }, now)).toThrow(/como máximo/);
  });

  it('invites more providers later without duplicates, keeping earlier quotes', () => {
    let db = createSeed(now);
    const first = createRequest(db, baseInput(), now);
    db = applyRequestAction(first.db, first.requests[0]!.id, { type: 'send_proposal', proposal: quote(40) }, 'mechanic', now).db;
    const caseId = first.requests[0]!.caseId;
    const more = inviteToCase(db, caseId, 'u-ana', ['m-nerea', 'm-carlos'], now);
    expect(more.requests.map((r) => r.mechanicId)).toEqual(['m-nerea']);
    expect(more.db.requests.find((r) => r.id === first.requests[0]!.id)!.proposals).toHaveLength(1);
    expect(() => inviteToCase(more.db, caseId, 'u-ana', ['m-nerea'], now)).toThrow(/ya tienen/);
    expect(() => inviteToCase(more.db, caseId, 'u-pablo', ['m-marta'], now)).toThrow(DomainError);
  });

  it('allows only one booking per request; the other providers are not selected', () => {
    const db = createSeed(now);
    // Seed case r-03: Carlos (40 €) and Nerea (50 €) both quoted Pablo.
    const r = applyRequestAction(db, 'r-13', { type: 'accept_proposal' }, 'owner', now);
    const carlos = r.db.requests.find((x) => x.id === 'r-03')!;
    expect(carlos.status).toBe('not_selected');
    expect(carlos.proposals[0]!.status).toBe('not_selected');
    expect(carlos.events.at(-1)!.type).toBe('not_selected');
    expect(() => applyRequestAction(r.db, 'r-03', { type: 'accept_proposal' }, 'owner', now)).toThrow(DomainError);
    expect(caseStatus(r.db.requests.filter((x) => x.caseId === 'r-03'))).toBe('booked');
  });

  it('versions quote revisions and needs a fresh approval', () => {
    const db = createSeed(now);
    const r = applyRequestAction(db, 'r-03', { type: 'revise_proposal', proposal: quote(45) }, 'mechanic', now);
    expect(r.request.status).toBe('proposal_received');
    expect(r.request.proposals.map((p) => p.status)).toEqual(['withdrawn', 'pending']);
    expect(r.request.events.at(-1)!.type).toBe('proposal_revised');
    expect(canPerform(r.request, 'revise_proposal', 'owner')).toBe(false);
    const accepted = applyRequestAction(r.db, 'r-03', { type: 'accept_proposal' }, 'owner', now).request;
    expect(accepted.proposals.find((p) => p.status === 'accepted')!.price).toBe(45);
  });

  it('opens the chat with an open proposal or after hiring, never with a quote alone', () => {
    const db = createSeed(now);
    const quoted = db.requests.find((r) => r.id === 'r-03')!;
    expect(chatUnlocked(quoted)).toBe(false);
    expect(() => applyRequestAction(db, 'r-03', { type: 'message', text: 'Hola', by: 'owner' }, 'owner', now)).toThrow(DomainError);
    const open = applyRequestAction(db, 'r-01', { type: 'send_open_proposal', message: '¿Puedes mandarme una foto de la pinza?' }, 'mechanic', now);
    expect(open.request.status).toBe('awaiting_proposal');
    expect(chatUnlocked(open.request)).toBe(true);
    expect(open.request.proposals).toHaveLength(0); // an open proposal is never a quote
    const hired = applyRequestAction(db, 'r-03', { type: 'accept_proposal' }, 'owner', now).request;
    expect(chatUnlocked(hired)).toBe(true);
  });

  it('suggests recovery without inviting anyone automatically', () => {
    const db = createSeed(now);
    const { requests } = createRequest(db, baseInput(), now);
    expect(recoveryHint(requests, now)).toBeNull();
    const later = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    expect(recoveryHint(requests, later)).toBe('no_response');
    const declined = requests.map((r) => ({ ...r, status: 'cancelled' as const }));
    expect(recoveryHint(declined, now)).toBe('all_declined');
  });

  it('matches only providers that can take the job, with factual reasons', () => {
    const db = createSeed(now);
    const criteria = { category: 'inspection' as const, bikeType: 'mtb' as const, mode: 'home' as const, location: 'rivas' as const };
    const matches = matchProviders(db.mechanics, db.reviews, criteria);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(canTake(m.mechanic, criteria)).toBe(true);
      expect(m.reasons[0]).toMatch(/domicilio en Rivas/);
    }
    expect(matchProviders(db.mechanics, db.reviews, { ...criteria, excludeMechanicId: 'm-nerea' }).some((m) => m.mechanic.id === 'm-nerea')).toBe(false);
  });
});

