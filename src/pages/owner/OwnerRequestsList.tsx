import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { STATUSES, bikeLabel, serviceLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { caseHref, caseStatus, groupCases, leadThread, type CaseStatus } from '@/domain/logic/cases';
import { attentionActionLabel, attentionFromActions, attentionHref, type CyclistAttention } from '@/domain/logic/home';
import { formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useRequestsFor } from '@/state/selectors';
import { EmptyState, cx } from '@/components/ui';

type View = 'activas' | 'completadas' | 'canceladas';
const VIEWS: Record<View, CaseStatus[]> = {
  activas: ['searching', 'proposals_received', 'booked'],
  completadas: ['completed'],
  // Not a main tab: reached from the end of Completadas.
  canceladas: ['canceled', 'unavailable'],
};

/** The status as the cyclist reads it on a card (one request = one mechanic). */
function statusText(r: ServiceRequest): string {
  if (r.status === 'confirmed') return 'Servicio contratado';
  return STATUSES[r.status].label;
}

/**
 * One request, one line of each: the service (main), the bike, its status, and the mechanic
 * with the price once there's a quote. A request with unresolved PendingActions of the cyclist
 * (the same ones the Request Hub counts) shows a lime dot, "Requiere tu atención" and what to
 * do instead of its status, and opens straight on that action. Finished ones are quieter.
 */
function RequestCard({ threads, mechanicName, pending }: { threads: ServiceRequest[]; mechanicName: (id: string) => string; pending: CyclistAttention[] }) {
  const lead = leadThread(threads);
  const status = caseStatus(threads);
  const quote = currentProposal(lead);
  const first = pending[0];
  const done = status === 'completed' || status === 'canceled' || status === 'unavailable';
  const showPrice = quote && quote.status !== 'withdrawn' && quote.status !== 'rejected' && !(lead.status === 'cancelled' && quote.status !== 'accepted');
  return (
    <Link
      to={first ? attentionHref(first) : caseHref(lead)}
      className={cx('surface group flex items-center gap-3 px-5 py-4', first && '!shadow-[0_0_0_1.5px_var(--color-lime),var(--shadow-surface)]')}
      data-testid="case-card"
      data-case-id={lead.caseId}
      data-attention={first ? 'true' : undefined}
    >
      <span className="min-w-0 flex-1">
        <span className={cx('block font-display text-[17px] font-bold leading-snug tracking-tight', done && 'text-muted')}>{serviceLabel(lead)}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{bikeLabel(lead.bike)}</span>
        <span className="mt-2 flex items-start gap-1.5 text-sm" data-testid="case-status-chip">
          <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', first ? 'bg-lime ring-2 ring-ink/80' : done ? 'bg-line-strong' : 'bg-ink/35')} aria-hidden />
          {first ? (
            <span className="min-w-0" data-testid="case-action">
              <span className="font-semibold">Requiere tu atención</span>
              <span className="text-muted"> · {attentionActionLabel(first)}</span>
            </span>
          ) : (
            <span className={cx('font-medium', done && 'text-muted')}>{statusText(lead)}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {mechanicName(lead.mechanicId)}
          {showPrice && ` · ${formatPrice(quote!.price)}`}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** The cyclist's requests: Activas and Completadas (cancelled ones one tap further, from Completadas). */
export function OwnerRequestsList() {
  const user = useCurrentUser()!;
  const requests = useRequestsFor({ ownerId: user.id });
  const mechanics = useApp((s) => s.db.mechanics);
  const mechanicName = (id: string) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  const [params, setParams] = useSearchParams();
  const view = (['activas', 'completadas', 'canceladas'].includes(params.get('estado') ?? '') ? params.get('estado') : 'activas') as View;
  const setView = (v: View) => setParams(v === 'activas' ? {} : { estado: v }, { replace: true });

  const cases = useMemo(() => groupCases(requests).map((c) => ({ ...c, status: caseStatus(c.threads) })), [requests]);
  // The cyclist's unresolved PendingActions (the Request Hub's), per request, most urgent first.
  const allRequests = useApp((s) => s.db.requests);
  const actions = useApp((s) => s.db.pendingActions);
  const pendingByCase = useMemo(() => {
    const map = new Map<string, CyclistAttention[]>();
    for (const a of attentionFromActions({ requests: allRequests, pendingActions: actions }, user.id)) map.set(a.request.caseId, [...(map.get(a.request.caseId) ?? []), a]);
    return map;
  }, [allRequests, actions, user.id]);
  const count = (v: View) => cases.filter((c) => VIEWS[v].includes(c.status)).length;
  const visible = cases.filter((c) => VIEWS[view].includes(c.status));
  // Requests that need the cyclist go first, in the order of their most urgent action.
  const urgency = [...pendingByCase.keys()];
  const rank = (caseId: string) => (urgency.includes(caseId) ? urgency.indexOf(caseId) : urgency.length);
  const sorted = [...visible].sort((a, b) => rank(a.caseId) - rank(b.caseId));

  if (requests.length === 0)
    return <EmptyState icon={<ClipboardList className="size-6" />} title="Aún no tienes solicitudes" description="Pulsa + para pedir un servicio. Aquí verás su estado y la respuesta del mecánico." />;

  const tab = (v: 'activas' | 'completadas', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v || (v === 'completadas' && view === 'canceladas')}
      onClick={() => setView(v)}
      className={cx(
        'relative pb-2 text-[15px] font-semibold transition-colors',
        view === v || (v === 'completadas' && view === 'canceladas') ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink' : 'text-muted hover:text-ink',
      )}
    >
      {label} <span className="font-normal text-muted">{count(v)}</span>
    </button>
  );

  return (
    <div>
      <div role="tablist" aria-label="Filtrar solicitudes" className="mb-5 flex gap-6 border-b border-line">
        {tab('activas', 'Activas')}
        {tab('completadas', 'Completadas')}
      </div>
      {view === 'canceladas' && (
        <button type="button" onClick={() => setView('completadas')} className="mb-4 text-sm font-semibold text-muted hover:text-ink" data-testid="back-to-completed">
          ← Canceladas · volver a completadas
        </button>
      )}
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted" data-testid="requests-empty">
          {view === 'activas' ? 'No tienes solicitudes activas. Pulsa + para pedir un servicio.' : view === 'completadas' ? 'Aún no has completado ningún servicio.' : 'No tienes solicitudes canceladas.'}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sorted.map((c) => (
            <li key={c.caseId}>
              <RequestCard threads={c.threads} mechanicName={mechanicName} pending={pendingByCase.get(c.caseId) ?? []} />
            </li>
          ))}
        </ul>
      )}
      {view === 'completadas' && count('canceladas') > 0 && (
        <button type="button" onClick={() => setView('canceladas')} className="mt-6 text-sm font-semibold text-muted hover:text-ink" data-testid="show-cancelled">
          Ver canceladas ({count('canceladas')})
        </button>
      )}
    </div>
  );
}
