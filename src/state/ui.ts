import { create } from 'zustand';

/** Global overlays of the cyclist navigation. One shared flag each, so only one can be open. */
interface NavUiState {
  newRequestOpen: boolean;
  searchOpen: boolean;
  openNewRequest(): void;
  closeNewRequest(): void;
  openSearch(): void;
  closeSearch(): void;
}

export const useNavUi = create<NavUiState>((set) => ({
  newRequestOpen: false,
  searchOpen: false,
  openNewRequest: () => set({ newRequestOpen: true, searchOpen: false }),
  closeNewRequest: () => set({ newRequestOpen: false }),
  openSearch: () => set({ searchOpen: true, newRequestOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
}));
