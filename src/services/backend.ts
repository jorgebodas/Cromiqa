// The only contract the UI/state layer depends on for data.
// Today: LocalStorage (see localBackend.ts). Later: a Supabase (or REST) implementation
// of this same interface can be dropped in via `services/index.ts` without touching pages.
import type {
  Bike,
  BikeInput,
  DemoDatabase,
  ID,
  Mechanic,
  MechanicProfilePatch,
  NewRequestInput,
  Role,
  ServiceRequest,
  User,
} from '@/domain/types';
import type { RequestAction } from '@/domain/logic/requests';

export interface CromiqaBackend {
  /** Everything the demo UI reads. A real backend would expose scoped queries instead. */
  loadAll(): Promise<DemoDatabase>;

  createRequest(input: NewRequestInput): Promise<ServiceRequest>;
  updateRequest(requestId: ID, action: RequestAction, actor: Role): Promise<ServiceRequest>;
  addReview(requestId: ID, ownerId: ID, input: { rating: number; text: string }): Promise<void>;

  addBike(ownerId: ID, input: BikeInput): Promise<Bike>;
  updateBike(ownerId: ID, bikeId: ID, input: BikeInput): Promise<Bike>;
  removeBike(ownerId: ID, bikeId: ID): Promise<void>;

  updateMechanic(mechanicId: ID, patch: MechanicProfilePatch): Promise<Mechanic>;
  updateUser(userId: ID, patch: Partial<Pick<User, 'name' | 'location'>>): Promise<User>;

  /** Demo only: restore the seed scenarios. */
  reset(): Promise<DemoDatabase>;
}
