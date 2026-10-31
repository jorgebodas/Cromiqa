import { create } from 'zustand';
import type { ID } from '@/domain/types';
import type { QuickScreen } from '@/domain/logic/hub';

/** What the Request Hub panel shows: the active requests, one of them, or the new-request form. */
export type HubView =
  | { kind: 'overview' }
  /** One request; `screen` opens its next meaningful action directly (default: the status summary). */
  | { kind: 'detail'; caseId: ID; screen?: QuickScreen }
  | { kind: 'new'; from?: 'overview' };

/** Presentation state of the cyclist's Request Hub (the domain data lives in the app store). */
interface NavUiState {
  hub: HubView | null;
  openHub(view: HubView): void;
  closeHub(): void;
  /** Shortcut used by every "Nueva solicitud" entry point. */
  openNewRequest(): void;
}

export const useNavUi = create<NavUiState>((set) => ({
  hub: null,
  openHub: (view) => set({ hub: view }),
  closeHub: () => set({ hub: null }),
  openNewRequest: () => set({ hub: { kind: 'new' } }),
}));
