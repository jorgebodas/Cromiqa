import { create } from 'zustand';
import type {
  BikeInput,
  BikeType,
  DemoDatabase,
  ID,
  InspectionDetails,
  LocationId,
  MechanicProfilePatch,
  NewRequestInput,
  Role,
  ServiceCategory,
  ServiceMode,
  ServiceRequest,
  TimeSlot,
  User,
} from '@/domain/types';
import { canPerform, type RequestAction } from '@/domain/logic/requests';
import { backend } from '@/services';
import { storage } from '@/services/storage';

const SESSION_KEY = 'cromiqa:demo:session';
const DRAFT_KEY = 'cromiqa:demo:draft';

export interface RequestDraft {
  /** Providers the cyclist picked (1–5), confirmed on the review step. */
  mechanicIds: ID[];
  /** Set when the request started from a provider's profile (mechanic-first). */
  originMechanicId?: ID;
  category?: ServiceCategory;
  description: string;
  bikeChoice: 'garage' | 'new';
  bikeId?: ID;
  bike: { type?: BikeType; brand: string; model: string; name: string; notes: string; year?: number };
  saveBike: boolean;
  inspection: InspectionDetails;
  location?: LocationId;
  mode?: ServiceMode;
  availability: { preferredDate?: string; timeSlots: TimeSlot[]; flexible: boolean; notes: string };
  step: number;
}

export const emptyDraft = (): RequestDraft => ({
  mechanicIds: [],
  description: '',
  bikeChoice: 'garage',
  bike: { brand: '', model: '', name: '', notes: '' },
  saveBike: true,
  inspection: {},
  availability: { timeSlots: [], flexible: false, notes: '' },
  step: 0,
});

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface AppState {
  ready: boolean;
  db: DemoDatabase;
  sessionUserId: ID | null;
  draft: RequestDraft;
  toasts: Toast[];

  init(): Promise<void>;
  switchUser(userId: ID | null): void;
  setDraft(patch: Partial<RequestDraft>): void;
  resetDraft(patch?: Partial<RequestDraft>): void;

  createRequest(input: NewRequestInput): Promise<ServiceRequest[]>;
  inviteToCase(caseId: ID, mechanicIds: ID[]): Promise<ServiceRequest[]>;
  /** Withdraws the whole request: every invitation not yet hired. */
  withdrawCase(caseId: ID, reason?: string): Promise<void>;
  actOnRequest(requestId: ID, action: RequestAction): Promise<ServiceRequest>;
  addReview(requestId: ID, input: { rating: number; text: string }): Promise<void>;
  addBike(input: BikeInput): Promise<void>;
  updateBike(bikeId: ID, input: BikeInput): Promise<void>;
  removeBike(bikeId: ID): Promise<void>;
  updateMechanic(patch: MechanicProfilePatch): Promise<void>;
  updateUser(patch: Partial<Pick<User, 'name' | 'location'>>): Promise<void>;
  resetDemo(opts?: { keepSession?: boolean }): Promise<void>;

  toast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
}

const emptyDb: DemoDatabase = { version: 0, users: [], mechanics: [], reviews: [], bikes: [], maintenance: [], requests: [] };
let toastSeq = 1;

export const useApp = create<AppState>((set, get) => {
  const refresh = async () => set({ db: await backend.loadAll() });
  const currentUser = () => {
    const { db, sessionUserId } = get();
    const user = db.users.find((u) => u.id === sessionUserId);
    if (!user) throw new Error('Elige una cuenta de demostración para continuar.');
    return user;
  };

  return {
    ready: false,
    db: emptyDb,
    sessionUserId: null,
    draft: emptyDraft(),
    toasts: [],

    async init() {
      const db = await backend.loadAll();
      const saved = storage.getJSON<{ userId: ID | null }>(SESSION_KEY);
      const sessionUserId = saved?.userId && db.users.some((u) => u.id === saved.userId) ? saved.userId : null;
      const draft = { ...emptyDraft(), ...(storage.getJSON<RequestDraft>(DRAFT_KEY) ?? {}) };
      if (!Array.isArray(draft.mechanicIds)) draft.mechanicIds = [];
      set({ db, sessionUserId, draft, ready: true });
    },

    switchUser(userId) {
      storage.setJSON(SESSION_KEY, { userId });
      // A garage bike from another account must not leak into the draft.
      const draft = get().draft;
      const nextDraft = draft.bikeId ? { ...draft, bikeId: undefined } : draft;
      storage.setJSON(DRAFT_KEY, nextDraft);
      set({ sessionUserId: userId, draft: nextDraft });
    },

    setDraft(patch) {
      const draft = { ...get().draft, ...patch };
      storage.setJSON(DRAFT_KEY, draft);
      set({ draft });
    },

    resetDraft(patch = {}) {
      const draft = { ...emptyDraft(), ...patch };
      storage.setJSON(DRAFT_KEY, draft);
      set({ draft });
    },

    async createRequest(input) {
      const requests = await backend.createRequest(input);
      await refresh();
      return requests;
    },

    async inviteToCase(caseId, mechanicIds) {
      const requests = await backend.inviteToCase(caseId, currentUser().id, mechanicIds);
      await refresh();
      return requests;
    },

    async withdrawCase(caseId, reason) {
      const user = currentUser();
      const open = get().db.requests.filter(
        (r) => r.caseId === caseId && r.ownerId === user.id && canPerform(r, 'cancel_by_owner', 'owner') && !r.proposals.some((p) => p.status === 'accepted'),
      );
      for (const r of open) await backend.updateRequest(r.id, { type: 'cancel_by_owner', reason }, 'owner');
      await refresh();
    },

    async actOnRequest(requestId, action) {
      const user = currentUser();
      // One account can be both sides: the role comes from how it relates to this request.
      const target = get().db.requests.find((r) => r.id === requestId);
      const actor: Role | null = !target ? null : target.ownerId === user.id ? 'owner' : target.mechanicId === user.mechanicId ? 'mechanic' : null;
      if (!actor) throw new Error('Esta solicitud no es tuya.');
      const request = await backend.updateRequest(requestId, action, actor);
      await refresh();
      return request;
    },

    async addReview(requestId, input) {
      await backend.addReview(requestId, currentUser().id, input);
      await refresh();
    },

    async addBike(input) {
      await backend.addBike(currentUser().id, input);
      await refresh();
    },
    async updateBike(bikeId, input) {
      await backend.updateBike(currentUser().id, bikeId, input);
      await refresh();
    },
    async removeBike(bikeId) {
      await backend.removeBike(currentUser().id, bikeId);
      await refresh();
    },
    async updateMechanic(patch) {
      const user = currentUser();
      if (!user.mechanicId) throw new Error('Esta cuenta no es de mecánico.');
      await backend.updateMechanic(user.mechanicId, patch);
      await refresh();
    },
    async updateUser(patch) {
      await backend.updateUser(currentUser().id, patch);
      await refresh();
    },

    async resetDemo(opts = {}) {
      const db = await backend.reset();
      const keep = opts.keepSession && db.users.some((u) => u.id === get().sessionUserId);
      const sessionUserId = keep ? get().sessionUserId : null;
      storage.setJSON(SESSION_KEY, { userId: sessionUserId });
      storage.remove(DRAFT_KEY);
      set({ db, sessionUserId, draft: emptyDraft() });
    },

    toast(message, tone = 'success') {
      const id = toastSeq++;
      set({ toasts: [...get().toasts, { id, message, tone }] });
      window.setTimeout(() => get().dismissToast(id), 4200);
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
  };
});
