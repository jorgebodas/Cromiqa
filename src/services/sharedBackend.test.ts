import { describe, expect, it } from 'vitest';
import type { DemoDatabase } from '@/domain/types';
import { matchProviders } from '@/domain/logic/matching';
import { TEST_MECHANIC_EMAILS } from '@/data/sharedSeed';
import { SharedBackend, WorldConflict, type WorldStore } from './sharedBackend';

/** One in-memory "Supabase" row shared by several backends (several phones). */
function memoryStore() {
  let row: { data: DemoDatabase; version: number } | null = null;
  const listeners = new Set<() => void>();
  let conflictsToInject = 0;
  let writes = 0;
  const store: WorldStore = {
    load: async () => (row ? structuredClone(row) : null),
    create: async (data) => {
      row ??= { data: structuredClone(data), version: 1 };
    },
    commit: async (expected, data) => {
      if (conflictsToInject > 0) {
        conflictsToInject--;
        row = { ...row!, version: row!.version + 1 }; // someone else saved meanwhile
        throw new WorldConflict();
      }
      if (!row || row.version !== expected) throw new WorldConflict();
      row = { data: structuredClone(data), version: expected + 1 };
      writes++;
      listeners.forEach((l) => l());
      return row.version;
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return { store, injectConflicts: (n: number) => (conflictsToInject = n), writes: () => writes };
}

const now = () => new Date('2026-11-02T10:00:00');

describe('shared test world', () => {
  it('starts with the three test workshops and links testers by email', async () => {
    const { store, writes } = memoryStore();
    const phone = new SharedBackend(store, now);
    const db = await phone.loadAll();
    expect(db.users.map((u) => u.email)).toEqual([...TEST_MECHANIC_EMAILS]);
    expect(db.requests).toHaveLength(0);
    // A workshop login maps to its mechanic account; a new person gets a cyclist account.
    expect(await phone.identify('Taller2@Cromiqa.com')).toBe('u-t2');
    const friend = await phone.identify('amigo@example.com', { name: 'Amigo', location: 'rivas' });
    expect((await phone.loadAll()).users.find((u) => u.id === friend)).toMatchObject({ name: 'Amigo', role: 'owner', location: 'rivas' });
    // Signing in again doesn't write anything.
    const before = writes();
    expect(await phone.identify('amigo@example.com')).toBe(friend);
    expect(writes()).toBe(before);
  });

  it('a request sent from one phone reaches the mechanic on another, live', async () => {
    const { store } = memoryStore();
    const friendPhone = new SharedBackend(store, now);
    const myPhone = new SharedBackend(store, now);
    let notified = 0;
    myPhone.subscribe(() => notified++);
    const friend = await friendPhone.identify('amigo@example.com', { name: 'Amigo', location: 'rivas' });
    const [sent] = await friendPhone.createRequest({
      ownerId: friend,
      mechanicIds: ['m-t2'],
      category: 'repair',
      description: 'El freno delantero no frena bien.',
      bike: { type: 'mtb', brand: '', model: '' },
      saveBikeToGarage: false,
      location: 'rivas',
      mode: 'home',
      availability: { timeSlots: [], flexible: true },
    });
    expect(notified).toBeGreaterThan(0);
    // Laura (taller2) sees it and sends a quote from her phone.
    const seen = (await myPhone.loadAll()).requests.find((r) => r.id === sent!.id)!;
    expect(seen.mechanicId).toBe('m-t2');
    await myPhone.updateRequest(seen.id, { type: 'accept_for_review' }, 'mechanic');
    expect((await friendPhone.loadAll()).requests.find((r) => r.id === sent!.id)!.status).toBe('awaiting_proposal');
  });

  it('retries on fresh data when someone saved at the same time', async () => {
    const { store, injectConflicts } = memoryStore();
    const phone = new SharedBackend(store, now);
    await phone.loadAll();
    injectConflicts(2);
    const id = await phone.identify('otra@example.com');
    expect((await phone.loadAll()).users.some((u) => u.id === id)).toBe(true);
  });

  it('reset clears requests for everyone but keeps the accounts', async () => {
    const { store } = memoryStore();
    const phone = new SharedBackend(store, now);
    const friend = await phone.identify('amigo@example.com', { name: 'Amigo' });
    await phone.createRequest({
      ownerId: friend,
      mechanicIds: ['m-t1'],
      category: 'maintenance',
      description: 'Puesta a punto general.',
      bike: { type: 'road', brand: '', model: '' },
      saveBikeToGarage: false,
      location: 'madrid-centro',
      mode: 'workshop',
      availability: { timeSlots: [], flexible: true },
    });
    const db = await phone.reset();
    expect(db.requests).toHaveLength(0);
    expect(db.users.some((u) => u.id === friend)).toBe(true);
    expect(db.mechanics).toHaveLength(3);
  });

  it('every zone and service finds at least one test workshop', async () => {
    const { store } = memoryStore();
    const db = await new SharedBackend(store, now).loadAll();
    for (const location of ['madrid-centro', 'madrid-vallecas', 'madrid-moratalaz', 'rivas', 'arganda', 'coslada', 'san-fernando', 'mejorada', 'velilla'] as const)
      for (const category of ['repair', 'maintenance', 'diagnosis'] as const)
        expect(matchProviders(db.mechanics, db.reviews, { category, bikeType: 'mtb', mode: 'home', location }).length, `${location} ${category}`).toBeGreaterThan(0);
  });
});
