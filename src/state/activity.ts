// "Actividad" for bike owners: updates derived from the events already stored on each
// request (nothing is generated on read), plus a per-account "seen up to" marker so the
// bell only counts what the owner hasn't looked at yet.
import { useMemo } from 'react';
import { create } from 'zustand';
import type { ID, RequestEventType, ServiceRequest } from '@/domain/types';
import { storage } from '@/services/storage';
import { useApp } from './store';

const SEEN_KEY = 'cromiqa:demo:activity-seen';

export interface ActivityItem {
  id: ID;
  requestId: ID;
  type: RequestEventType;
  at: string;
  title: string;
  text?: string;
}

/** Events the mechanic triggers are news for the owner; the owner's own actions are not. */
const OWNER_NEWS: Partial<Record<RequestEventType, (mechanic: string) => string>> = {
  accepted_for_review: (m) => `${m} está revisando tu solicitud`,
  proposal_sent: (m) => `${m} te ha enviado una propuesta`,
  started: (m) => `${m} ha empezado el trabajo`,
  completed: (m) => `${m} ha terminado el servicio`,
  rejected_by_mechanic: (m) => `${m} no puede atender tu solicitud`,
  message: (m) => `Mensaje de ${m}`,
};

export function ownerActivity(requests: ServiceRequest[], mechanicName: (id: ID) => string): ActivityItem[] {
  return requests
    .flatMap((r) =>
      r.events
        .filter((e) => e.by === 'mechanic' && OWNER_NEWS[e.type])
        .map((e) => ({ id: e.id, requestId: r.id, type: e.type, at: e.at, title: OWNER_NEWS[e.type]!(mechanicName(r.mechanicId)), text: e.text })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

interface SeenState {
  seen: Record<ID, string>;
  markSeen(userId: ID, at: string): void;
}

export const useActivitySeen = create<SeenState>((set, get) => ({
  seen: storage.getJSON<Record<ID, string>>(SEEN_KEY) ?? {},
  markSeen(userId, at) {
    if ((get().seen[userId] ?? '') >= at) return;
    const seen = { ...get().seen, [userId]: at };
    storage.setJSON(SEEN_KEY, seen);
    set({ seen });
  },
}));

/** The owner's updates, newest first, and how many arrived after they last looked. */
export function useOwnerActivity(userId: ID | undefined) {
  const requests = useApp((s) => s.db.requests);
  const mechanics = useApp((s) => s.db.mechanics);
  const seenAt = useActivitySeen((s) => (userId ? s.seen[userId] : undefined));
  return useMemo(() => {
    if (!userId) return { items: [] as ActivityItem[], unread: 0, seenAt };
    const name = (id: ID) => mechanics.find((m) => m.id === id)?.name ?? 'El mecánico';
    const items = ownerActivity(requests.filter((r) => r.ownerId === userId), name);
    const unread = items.filter((i) => !seenAt || i.at > seenAt).length;
    return { items, unread, seenAt };
  }, [requests, mechanics, userId, seenAt]);
}
