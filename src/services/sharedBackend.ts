// Shared test world: one versioned document that every signed-in tester reads and writes, so
// a request sent from one phone reaches the mechanic on another, live. The business rules are
// the same pure functions the local demo uses (see DomainBackend).
import type { DemoDatabase, ID, LocationId, User } from '@/domain/types';
import { runScheduledTransitions } from '@/domain/logic/requests';
import { uid } from '@/domain/utils';
import { createSharedSeed } from '@/data/sharedSeed';
import { DomainBackend } from './domainBackend';

export interface WorldRow {
  data: DemoDatabase;
  version: number;
}

/** Where the shared document lives. Supabase in production; an in-memory fake in tests. */
export interface WorldStore {
  load(): Promise<WorldRow | null>;
  /** Creates the document if it doesn't exist yet (no-op if someone else just did). */
  create(data: DemoDatabase): Promise<void>;
  /** Saves only if the stored version is still `expected`; throws WorldConflict otherwise. */
  commit(expected: number, data: DemoDatabase): Promise<number>;
  /** Calls back whenever someone else saves. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

export class WorldConflict extends Error {
  constructor() {
    super('Otra persona acaba de hacer un cambio. Inténtalo de nuevo.');
    this.name = 'WorldConflict';
  }
}

const MAX_ATTEMPTS = 4;

export class SharedBackend extends DomainBackend {
  constructor(
    private readonly store: WorldStore,
    now: () => Date = () => new Date(),
  ) {
    super(now);
  }

  private async read(): Promise<WorldRow> {
    let row = await this.store.load();
    if (!row) {
      await this.store.create(createSharedSeed());
      row = await this.store.load();
    }
    if (!row) throw new Error('No se pudo cargar el entorno de prueba compartido.');
    return row;
  }

  /** Read the latest, apply, save if nobody saved in between; otherwise retry on fresh data. */
  protected async commit<T>(fn: (db: DemoDatabase) => { db: DemoDatabase; result: T }): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const row = await this.read();
      // Time-based transitions (the 72 h closure) are applied before every change too.
      const { db, result } = fn(runScheduledTransitions(row.data, this.now()));
      try {
        await this.store.commit(row.version, db);
        return result;
      } catch (err) {
        if (!(err instanceof WorldConflict) || attempt >= MAX_ATTEMPTS) throw err;
      }
    }
  }

  async loadAll(): Promise<DemoDatabase> {
    return runScheduledTransitions((await this.read()).data, this.now());
  }

  /** Restores the test workshops and clears requests, bikes and reviews; signed-up people keep their accounts. */
  reset(): Promise<DemoDatabase> {
    return this.commit((db) => {
      const seed = createSharedSeed();
      const seedEmails = new Set(seed.users.map((u) => u.email.toLowerCase()));
      const people = db.users
        .filter((u) => !seedEmails.has(u.email.toLowerCase()))
        .map(({ mechanicId: _m, ...u }) => ({ ...u, role: 'owner' as const }));
      const next = { ...seed, users: [...seed.users, ...people] };
      return { db: next, result: next };
    });
  }

  /**
   * The app user for a signed-in tester, matched by email. New testers get a cyclist account
   * (they can create a professional profile from Perfil, like anyone).
   */
  async identify(email: string, profile: { name?: string; location?: LocationId } = {}): Promise<ID> {
    const key = email.trim().toLowerCase();
    // Known tester: no write (every write notifies everyone).
    const known = (await this.read()).data.users.find((u) => u.email.toLowerCase() === key);
    if (known) return known.id;
    return this.commit((db) => {
      const existing = db.users.find((u) => u.email.toLowerCase() === key);
      if (existing) return { db, result: existing.id };
      const user: User = {
        id: uid('u'),
        name: profile.name?.trim() || key.split('@')[0]!,
        role: 'owner',
        email: key,
        location: profile.location ?? 'madrid-centro',
        demoBlurb: 'Probador',
      };
      return { db: { ...db, users: [...db.users, user] }, result: user.id };
    });
  }

  subscribe(onChange: () => void) {
    return this.store.subscribe(onChange);
  }
}
