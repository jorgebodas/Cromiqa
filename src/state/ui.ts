import { create } from 'zustand';
/** What the floating box shows: the new-request form. Requests themselves are managed in /solicitudes. */
export type HubView = { kind: 'new' };

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
