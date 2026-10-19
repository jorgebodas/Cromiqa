import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { relativeTime } from '@/domain/utils';
import { categoryLabel } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useActivitySeen, useOwnerActivity } from '@/state/activity';
import { useNavUi } from '@/state/ui';
import { RoleGate } from '@/components/layout/RoleGate';
import { BackLink } from '@/components/layout/BackLink';
import { EmptyState, PageHeader, cx } from '@/components/ui';
import { OwnerRequestsList } from './OwnerRequestsList';

type Section = 'solicitudes' | 'novedades';

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
    <ul className="divide-y divide-line rounded-3xl border border-line" data-testid="updates">
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

function Inner() {
  const user = useCurrentUser()!;
  const { unread } = useOwnerActivity(user.id);
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  const [params, setParams] = useSearchParams();
  const section: Section = params.get('ver') === 'novedades' ? 'novedades' : 'solicitudes';
  const tabs: { id: Section; label: string; badge?: number }[] = [
    { id: 'solicitudes', label: 'Solicitudes' },
    { id: 'novedades', label: 'Novedades', badge: unread },
  ];

  return (
    <div className="container-page max-w-4xl py-6 sm:py-10">
      <BackLink fallback="/" className="mb-5">
        Volver
      </BackLink>
      <PageHeader eyebrow="Actividad" title="Actividad" description="Tus solicitudes, su estado y las respuestas de los mecánicos." />
      <div role="tablist" aria-label="Actividad" className="mb-6 flex gap-6 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={section === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setParams(t.id === 'novedades' ? { ver: 'novedades' } : {}, { replace: true })}
            className={cx(
              '-mb-px flex h-11 items-center gap-2 border-b-2 text-[15px] font-semibold transition-colors',
              section === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {!!t.badge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-paper">{t.badge}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
        {section === 'solicitudes' ? <OwnerRequestsList onNewRequest={openNewRequest} /> : <Updates />}
      </div>
    </div>
  );
}

export function ActivityPage() {
  return (
    <RoleGate role="owner" reason="Actividad reúne las solicitudes de un propietario. Las cuentas de mecánico las gestionan desde su panel.">
      <Inner />
    </RoleGate>
  );
}
