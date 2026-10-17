import { beforeEach, describe, expect, it } from 'vitest';
import { DB_KEY, LocalBackend } from './localBackend';

const now = () => new Date('2026-10-17T10:00:00');

describe('LocalBackend persistence', () => {
  beforeEach(() => localStorage.clear());

  it('seeds on first load and persists to LocalStorage', async () => {
    const backend = new LocalBackend(now);
    const db = await backend.loadAll();
    expect(db.requests.length).toBeGreaterThanOrEqual(10);
    expect(localStorage.getItem(DB_KEY)).not.toBeNull();
  });

  it('keeps changes across instances (page reloads)', async () => {
    const a = new LocalBackend(now);
    await a.updateRequest('r-01', { type: 'accept_for_review' }, 'mechanic');
    await a.updateMechanic('m-carlos', { headline: 'Especialista en suspensiones' });
    await a.addBike('u-ana', { name: 'Gravel nueva', brand: 'Orbea', model: 'Terra', type: 'gravel' });

    const b = new LocalBackend(now);
    const db = await b.loadAll();
    expect(db.requests.find((r) => r.id === 'r-01')!.status).toBe('awaiting_proposal');
    expect(db.mechanics.find((m) => m.id === 'm-carlos')!.headline).toBe('Especialista en suspensiones');
    expect(db.bikes.some((x) => x.name === 'Gravel nueva')).toBe(true);
  });

  it('reset restores the seed scenarios', async () => {
    const backend = new LocalBackend(now);
    await backend.updateRequest('r-01', { type: 'accept_for_review' }, 'mechanic');
    const db = await backend.reset();
    expect(db.requests.find((r) => r.id === 'r-01')!.status).toBe('sent');
  });

  it('rejects invalid mutations without corrupting stored data', async () => {
    const backend = new LocalBackend(now);
    await expect(backend.updateRequest('r-01', { type: 'complete' }, 'mechanic')).rejects.toThrow();
    await expect(backend.addBike('u-ana', { name: '', brand: '', model: '', type: 'mtb' })).rejects.toThrow();
    const db = await new LocalBackend(now).loadAll();
    expect(db.requests.find((r) => r.id === 'r-01')!.status).toBe('sent');
  });

  it('recovers from corrupt storage', async () => {
    localStorage.setItem(DB_KEY, '{not json');
    const db = await new LocalBackend(now).loadAll();
    expect(db.mechanics.length).toBe(6);
  });
});
