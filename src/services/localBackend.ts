import type { DemoDatabase } from '@/domain/types';
import { runScheduledTransitions } from '@/domain/logic/requests';
import { SEED_VERSION, createSeed } from '@/data/seed';
import { DomainBackend } from './domainBackend';
import { storage } from './storage';

export const DB_KEY = 'cromiqa:demo:db';

/**
 * Demo backend persisted in LocalStorage. All business rules live in
 * `domain/logic`, so this class only loads, applies and saves.
 */
export class LocalBackend extends DomainBackend {
  private db: DemoDatabase;

  constructor(now: () => Date = () => new Date()) {
    super(now);
    this.db = this.read() ?? this.write(createSeed(this.now()));
  }

  private read(): DemoDatabase | null {
    const parsed = storage.getJSON<DemoDatabase>(DB_KEY);
    if (!parsed || parsed.version !== SEED_VERSION || !Array.isArray(parsed.requests)) return null;
    // Time-based transitions (72 h closure) run on every read: idempotent and restart-safe.
    // Integration point: a real backend runs `runScheduledTransitions` from a server scheduler.
    const due = runScheduledTransitions(parsed, this.now());
    if (due !== parsed) storage.setJSON(DB_KEY, due);
    return due;
  }

  private write(db: DemoDatabase): DemoDatabase {
    this.db = db;
    storage.setJSON(DB_KEY, db);
    return db;
  }

  /** Apply a pure mutation and persist the result. */
  protected commit<T>(fn: (db: DemoDatabase) => { db: DemoDatabase; result: T }): Promise<T> {
    try {
      const { db, result } = fn(this.read() ?? this.db);
      this.write(db);
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  loadAll() {
    return Promise.resolve(this.read() ?? this.db);
  }

  reset() {
    return Promise.resolve(this.write(createSeed(this.now())));
  }
}
