import { useMemo } from 'react';
import { create } from 'zustand';
import type { ID } from '@/domain/types';
import { MODE_HOME, resolveMode, type AppMode } from '@/domain/logic/modes';
import { storage } from '@/services/storage';
import { useCurrentUser } from './selectors';

const KEY = 'cromiqa:demo:modes';

interface Remembered {
  mode?: AppMode;
  /** Last visited place in each mode, so switching back returns there. */
  last: Partial<Record<AppMode, string>>;
}

interface ModeState {
  byUser: Record<ID, Remembered>;
  setMode(userId: ID, mode: AppMode): void;
  remember(userId: ID, mode: AppMode, path: string): void;
}

function save(byUser: Record<ID, Remembered>) {
  storage.setJSON(KEY, byUser);
}

export const useModeStore = create<ModeState>((set, get) => ({
  byUser: storage.getJSON<Record<ID, Remembered>>(KEY) ?? {},
  setMode(userId, mode) {
    const current = get().byUser[userId] ?? { last: {} };
    const byUser = { ...get().byUser, [userId]: { ...current, mode } };
    save(byUser);
    set({ byUser });
  },
  remember(userId, mode, path) {
    const current = get().byUser[userId] ?? { last: {} };
    if (current.last[mode] === path) return;
    const byUser = { ...get().byUser, [userId]: { ...current, last: { ...current.last, [mode]: path } } };
    save(byUser);
    set({ byUser });
  },
}));

/** The mode the current account is using. Guests are always cyclists. */
export function useMode(): AppMode {
  const user = useCurrentUser();
  const stored = useModeStore((s) => (user ? s.byUser[user.id]?.mode : undefined));
  return useMemo(() => resolveMode(user, stored), [user, stored]);
}

/** Where to go when entering a mode: the last place visited in it, or its home. */
export function lastPlaceIn(userId: ID | undefined, mode: AppMode): string {
  if (!userId) return MODE_HOME[mode];
  return useModeStore.getState().byUser[userId]?.last[mode] ?? MODE_HOME[mode];
}
