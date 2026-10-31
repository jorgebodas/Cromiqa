import { create } from 'zustand';

/** Global overlay of the cyclist navigation: the "Nueva solicitud" sheet. */
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
