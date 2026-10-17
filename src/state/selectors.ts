import { useMemo } from 'react';
import type { ID, RequestStatus } from '@/domain/types';
import { ratingFor } from '@/domain/logic/search';
import { useApp } from './store';

export function useCurrentUser() {
  const users = useApp((s) => s.db.users);
  const id = useApp((s) => s.sessionUserId);
  return useMemo(() => users.find((u) => u.id === id) ?? null, [users, id]);
}

export function useMechanic(id: ID | undefined) {
  const mechanics = useApp((s) => s.db.mechanics);
  return useMemo(() => mechanics.find((m) => m.id === id), [mechanics, id]);
}

export function useCurrentMechanic() {
  const user = useCurrentUser();
  return useMechanic(user?.mechanicId);
}

export function useMechanicRating(id: ID | undefined) {
  const reviews = useApp((s) => s.db.reviews);
  return useMemo(() => (id ? ratingFor(id, reviews) : { rating: 0, reviewCount: 0 }), [id, reviews]);
}

export function useOwnerBikes(ownerId: ID | undefined) {
  const bikes = useApp((s) => s.db.bikes);
  return useMemo(() => bikes.filter((b) => b.ownerId === ownerId), [bikes, ownerId]);
}

export function useRequest(id: ID | undefined) {
  const requests = useApp((s) => s.db.requests);
  return useMemo(() => requests.find((r) => r.id === id), [requests, id]);
}

export function useRequestsFor(filter: { ownerId?: ID; mechanicId?: ID }) {
  const requests = useApp((s) => s.db.requests);
  return useMemo(
    () =>
      requests
        .filter((r) => (filter.ownerId ? r.ownerId === filter.ownerId : true))
        .filter((r) => (filter.mechanicId ? r.mechanicId === filter.mechanicId : true))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [requests, filter.ownerId, filter.mechanicId],
  );
}

export function useUserName(id: ID | undefined) {
  const users = useApp((s) => s.db.users);
  return users.find((u) => u.id === id)?.name ?? 'Usuario';
}

export const ACTIVE_STATUSES: RequestStatus[] = ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed', 'in_progress'];
