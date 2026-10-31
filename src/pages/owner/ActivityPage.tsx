import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { relativeTime } from '@/domain/utils';
import { categoryLabel } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useActivitySeen, useOwnerActivity } from '@/state/activity';
import { RoleGate } from '@/components/layout/RoleGate';
import { EmptyState, cx } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function Updates() {
  const user = useCurrentUser()!;
  const { items } = useOwnerActivity(user.id);
  const requests = useApp((s) => s.db.requests);
  const markSeen = useActivitySeen((s) => s.markSeen);
  // Highlight what was new when the tab opened, then mark everything as read.
  const seenOnOpen = useRef(useActivitySeen.getState().seen[user.id]);
  useEffect(() => {
    if (items[0]) markSeen(user.id, items[0].at);
  }, [items, markSeen, user.id]);

  if (!items.length) {
    return (
      <EmptyState
        icon={<Bell className="size-6" />}
        title="Sin novedades"
        description="Aquí verás las propuestas, confirmaciones y cambios de estado de tus solicitudes."
      />
    );
  }
  return (
    <ul className="surface divide-y divide-line overflow-hidden" data-testid="updates">
      {items.map((item) => {
        const request = requests.find((r) => r.id === item.requestId);
        const isNew = !seenOnOpen.current || item.at > seenOnOpen.current;
        return (
          <li key={item.id}>
            <Link to={`/solicitudes/${item.requestId}`} className="flex items-start gap-3 px-4 py-4 hover:bg-sand/60 sm:px-5">
              <span className={cx('mt-2 size-2 shrink-0 rounded-full', isNew ? 'bg-ink' : 'bg-transparent')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">
                  {item.title}
                  {isNew && <span className="sr-only"> (nueva)</span>}
                </span>
                {item.text && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{item.text}</span>}
                <span className="mt-1 block text-xs text-muted">
                  {request ? `${categoryLabel(request.category)} · ${request.code} · ` : ''}
                  {relativeTime(item.at)}
                </span>
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Notifications (the bell): what mechanics did on your requests, newest first. */
function Inner() {
  return (
    <>
      <ScreenHeader title="Notificaciones" back="/" />
      <div className="container-page max-w-3xl pb-8 sm:pb-10">
        <Updates />
      </div>
    </>
  );
}

export function ActivityPage() {
  return (
    <RoleGate role="owner" reason="Las notificaciones de tus solicitudes como ciclista.">
      <Inner />
    </RoleGate>
  );
}
