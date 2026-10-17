import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import type { NewRequestInput } from '@/domain/types';
import { addReview, applyRequestAction, canPerform, createRequest, DomainError, validateProposal } from './requests';
import { toISODate, addDays } from '../utils';

const now = new Date('2026-10-17T10:00:00');
const tomorrow = toISODate(addDays(now, 1));

const baseInput = (): NewRequestInput => ({
  ownerId: 'u-ana',
  mechanicId: 'm-carlos',
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
    const { db: next, request } = createRequest(db, baseInput(), now);
    expect(request.status).toBe('sent');
    expect(request.code).toBe('CRQ-1013');
    expect(next.requests[0]!.id).toBe(request.id);
    expect(request.events[0]!.type).toBe('created');
  });

  it('rejects short descriptions and incompatible modes', () => {
    const db = createSeed(now);
    expect(() => createRequest(db, { ...baseInput(), description: 'ruido' }, now)).toThrow(DomainError);
    // Andrés has no home service
    expect(() => createRequest(db, { ...baseInput(), mechanicId: 'm-andres', bikeId: undefined, location: 'madrid-vallecas' }, now)).toThrow(/domicilio/);
    // Javi does not travel to Coslada
    expect(() => createRequest(db, { ...baseInput(), mechanicId: 'm-javi', location: 'coslada' }, now)).toThrow(/zona/);
  });

  it('can save a new bike to the garage', () => {
    const db = createSeed(now);
    const { db: next, request } = createRequest(
      db,
      { ...baseInput(), bikeId: undefined, bike: { type: 'mtb', brand: 'Giant', model: 'Talon' }, saveBikeToGarage: true },
      now,
    );
    expect(request.bikeId).toBeDefined();
    expect(next.bikes.find((b) => b.id === request.bikeId)?.ownerId).toBe('u-ana');
  });
});

describe('request lifecycle', () => {
  it('runs sent → completed and writes a maintenance record', () => {
    let db = createSeed(now);
    const created = createRequest(db, baseInput(), now);
    db = created.db;
    const id = created.request.id;
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

  it('rejecting a proposal returns to awaiting_proposal and allows a new one', () => {
    const db = createSeed(now);
    let r = applyRequestAction(db, 'r-03', { type: 'reject_proposal', reason: 'Muy caro' }, 'owner', now);
    expect(r.request.status).toBe('awaiting_proposal');
    expect(r.request.proposals[0]!.status).toBe('rejected');
    r = applyRequestAction(r.db, 'r-03', { type: 'send_proposal', proposal: { price: 30, date: tomorrow, time: '19:00', message: 'Te lo dejo en 30 €.' } }, 'mechanic', now);
    expect(r.request.status).toBe('proposal_received');
    expect(r.request.proposals).toHaveLength(2);
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
