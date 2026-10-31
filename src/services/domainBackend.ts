// The business operations every backend offers, as pure domain functions applied inside a
// commit. Backends only decide where the data lives (this browser, or a shared store).
import type { DemoDatabase } from '@/domain/types';
import { addReview, applyRequestAction, createRequest, inviteToCase } from '@/domain/logic/requests';
import { addBike, removeBike, updateBike, updateMechanic, updateUser } from '@/domain/logic/garage';
import { approveProfessionalProfile, submitProfessionalProfile } from '@/domain/logic/onboarding';
import type { CromiqaBackend } from './backend';

export abstract class DomainBackend implements CromiqaBackend {
  constructor(protected readonly now: () => Date = () => new Date()) {}

  /** Apply a pure mutation to the latest data and persist the result. */
  protected abstract commit<T>(fn: (db: DemoDatabase) => { db: DemoDatabase; result: T }): Promise<T>;
  abstract loadAll(): Promise<DemoDatabase>;
  abstract reset(): Promise<DemoDatabase>;

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

  submitProfessionalProfile: CromiqaBackend['submitProfessionalProfile'] = (userId, draft) =>
    this.commit((db) => {
      const r = submitProfessionalProfile(db, userId, draft);
      return { db: r.db, result: r.mechanic };
    });

  approveProfessionalProfile: CromiqaBackend['approveProfessionalProfile'] = (mechanicId) =>
    this.commit((db) => {
      const r = approveProfessionalProfile(db, mechanicId);
      return { db: r.db, result: r.mechanic };
    });

}
