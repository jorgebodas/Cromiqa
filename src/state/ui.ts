import { create } from 'zustand';

/** Global overlay of the cyclist navigation. One shared flag, so only one instance can open. */
interface NavUiState {
  newRequestOpen: boolean;
  openNewRequest(): void;
  closeNewRequest(): void;
}

export const useNavUi = create<NavUiState>((set) => ({
  newRequestOpen: false,
  openNewRequest: () => set({ newRequestOpen: true }),
  closeNewRequest: () => set({ newRequestOpen: false }),
}));
