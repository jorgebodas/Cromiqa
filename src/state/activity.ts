// "Actividad" for bike owners: updates derived from the events already stored on each
// request (nothing is generated on read), plus a per-account "seen up to" marker so the
// bell only counts what the owner hasn't looked at yet.
import { useMemo } from 'react';
import { create } from 'zustand';
import type { ID, RequestEventType, ServiceRequest } from '@/domain/types';
import { AUTO_CLOSE_REMINDER_HOURS, autoCloseAt, autoCloseReminderDue } from '@/domain/logic/requests';
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
  proposal_sent: (m) => `${m} te ha enviado un presupuesto`,
  proposal_revised: (m) => `${m} ha revisado su presupuesto`,
  open_proposal_sent: (m) => `${m} necesita aclarar algo`,
  started: (m) => `${m} ha empezado el trabajo`,
  completed: (m) => `${m} ha terminado el servicio`,
  rejected_by_mechanic: (m) => `${m} no puede atender tu solicitud`,
  appointment_proposed: (m) => `${m} propone una cita`,
  appointment_confirmed: (m) => `${m} confirmó la cita`,
  work_finished: (m) => `${m} ha terminado el trabajo: confírmalo o reporta un problema`,
  cancelled_by_mechanic: (m) => `${m} canceló el servicio`,
  message: (m) => `Mensaje de ${m}`,
};

const HOUR = 3600_000;

export function ownerActivity(requests: ServiceRequest[], mechanicName: (id: ID) => string, now = new Date()): ActivityItem[] {
  return requests
    .flatMap((r) => {
      const items: ActivityItem[] = r.events
        .filter((e) => e.by === 'mechanic' && OWNER_NEWS[e.type])
        .map((e) => ({ id: e.id, requestId: r.id, type: e.type, at: e.at, title: OWNER_NEWS[e.type]!(mechanicName(r.mechanicId)), text: e.text }));
      // System notices, derived from stored timestamps: the 24 h reminder and the closure itself.
      const closesAt = autoCloseAt(r);
      if (closesAt && autoCloseReminderDue(r, now)) {
        const at = new Date(closesAt.getTime() - AUTO_CLOSE_REMINDER_HOURS * HOUR).toISOString();
        items.push({ id: `${r.id}-reminder`, requestId: r.id, type: 'work_finished', at, title: 'Se cerrará automáticamente en 24 h', text: 'Confírmalo o reporta un problema si algo no está bien.' });
      }
      for (const e of r.events.filter((x) => x.type === 'auto_closed'))
        items.push({ id: e.id, requestId: r.id, type: e.type, at: e.at, title: 'Servicio cerrado automáticamente', text: 'Pasaron 72 h sin confirmación ni problemas reportados.' });
      return items;
    })
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
