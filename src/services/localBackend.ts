import type { DemoDatabase } from '@/domain/types';
import { addReview, applyRequestAction, createRequest, inviteToCase } from '@/domain/logic/requests';
import { addBike, removeBike, updateBike, updateMechanic, updateUser } from '@/domain/logic/garage';
import { SEED_VERSION, createSeed } from '@/data/seed';
import type { CromiqaBackend } from './backend';
import { storage } from './storage';

export const DB_KEY = 'cromiqa:demo:db';

/**
 * Demo backend persisted in LocalStorage. All business rules live in
 * `domain/logic`, so this class only loads, applies and saves.
 */
export class LocalBackend implements CromiqaBackend {
  private db: DemoDatabase;

  constructor(private readonly now: () => Date = () => new Date()) {
    this.db = this.read() ?? this.write(createSeed(this.now()));
  }

  private read(): DemoDatabase | null {
    const parsed = storage.getJSON<DemoDatabase>(DB_KEY);
    if (!parsed || parsed.version !== SEED_VERSION || !Array.isArray(parsed.requests)) return null;
    return parsed;
  }

  private write(db: DemoDatabase): DemoDatabase {
    this.db = db;
    storage.setJSON(DB_KEY, db);
    return db;
  }

  /** Apply a pure mutation and persist the result. */
  private commit<T>(fn: (db: DemoDatabase) => { db: DemoDatabase; result: T }): Promise<T> {
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

  createRequest: CromiqaBackend['createRequest'] = (input) =>
    this.commit((db) => {
      const r = createRequest(db, input, this.now());
      return { db: r.db, result: r.requests };
    });

  inviteToCase: CromiqaBackend['inviteToCase'] = (caseId, ownerId, mechanicIds) =>
    this.commit((db) => {
      const r = inviteToCase(db, caseId, ownerId, mechanicIds, this.now());
      return { db: r.db, result: r.requests };
    });

  updateRequest: CromiqaBackend['updateRequest'] = (id, action, actor) =>
    this.commit((db) => {
      const r = applyRequestAction(db, id, action, actor, this.now());
      return { db: r.db, result: r.request };
    });

  addReview: CromiqaBackend['addReview'] = (requestId, ownerId, input) =>
    this.commit((db) => ({ db: addReview(db, requestId, ownerId, input, this.now()), result: undefined }));

  addBike: CromiqaBackend['addBike'] = (ownerId, input) =>
    this.commit((db) => {
      const r = addBike(db, ownerId, input, this.now());
      return { db: r.db, result: r.bike };
    });

  updateBike: CromiqaBackend['updateBike'] = (ownerId, bikeId, input) =>
    this.commit((db) => {
      const r = updateBike(db, ownerId, bikeId, input);
      return { db: r.db, result: r.bike };
    });

  removeBike: CromiqaBackend['removeBike'] = (ownerId, bikeId) =>
    this.commit((db) => ({ db: removeBike(db, ownerId, bikeId), result: undefined }));

  updateMechanic: CromiqaBackend['updateMechanic'] = (id, patch) =>
    this.commit((db) => {
      const r = updateMechanic(db, id, patch);
      return { db: r.db, result: r.mechanic };
    });

  updateUser: CromiqaBackend['updateUser'] = (id, patch) =>
    this.commit((db) => {
      const r = updateUser(db, id, patch);
      return { db: r.db, result: r.user };
    });

  reset() {
    return Promise.resolve(this.write(createSeed(this.now())));
  }
}
