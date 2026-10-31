import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bike, ChevronRight, ClipboardList } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { categoryLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { CASE_STATUS_LABEL, caseHref, caseStatus, groupCases, leadThread, type CaseStatus } from '@/domain/logic/cases';
import { formatDate, formatPrice, relativeTime } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useRequestsFor } from '@/state/selectors';
import { EmptyState, TabBar, cx } from '@/components/ui';

type Tab = 'activas' | 'completadas' | 'canceladas' | 'todas';
const TABS: { id: Tab; label: string; statuses?: CaseStatus[] }[] = [
  { id: 'activas', label: 'Activas', statuses: ['searching', 'proposals_received', 'booked'] },
  { id: 'completadas', label: 'Completadas', statuses: ['completed'] },
  { id: 'canceladas', label: 'Canceladas', statuses: ['canceled', 'unavailable'] },
  { id: 'todas', label: 'Todas' },
];

/** One row per request: its derived status and a one-line summary of the answers. */
function CaseCard({ threads, mechanicName }: { threads: ServiceRequest[]; mechanicName: (id: string) => string }) {
  const status = caseStatus(threads);
  const lead = leadThread(threads);
  const quotes = threads.filter((r) => r.status === 'proposal_received');
  const p = currentProposal(lead);
  const needsMe = status === 'proposals_received';
  const summary = (() => {
    if (status === 'booked' || status === 'completed') return `${mechanicName(lead.mechanicId)}${p ? ` · ${formatPrice(p.price)} · ${formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}`;
    if (quotes.length > 1) return `${quotes.length} presupuestos · desde ${formatPrice(Math.min(...quotes.map((r) => currentProposal(r)?.price ?? 0)))}`;
    if (quotes.length === 1) return `Presupuesto de ${mechanicName(quotes[0]!.mechanicId)} · ${formatPrice(currentProposal(quotes[0]!)?.price ?? 0)}`;
    if (status === 'proposals_received') return 'Un mecánico necesita aclarar algo';
    return threads.length === 1 ? `Enviada a ${mechanicName(lead.mechanicId)}` : `Enviada a ${threads.length} mecánicos`;
  })();
  return (
    <Link to={caseHref(lead)} className={cx('surface group block p-4 sm:p-5', needsMe && 'ring-2 ring-ink')} data-testid="case-card" data-case-id={lead.caseId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{relativeTime(threads.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), ''))}</p>
          <h3 className="mt-1 font-bold leading-snug">{categoryLabel(lead.category)}</h3>
        </div>
        <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', needsMe ? 'bg-ink text-paper' : 'bg-canvas')}>{CASE_STATUS_LABEL[status]}</span>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
        <Bike className="size-4" aria-hidden />
        {lead.bike.brand} {lead.bike.model}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className={needsMe ? 'font-semibold' : 'text-muted'}>{summary}</span>
        <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}

/** The owner's requests, one card per request (all its invitations), with status segments in `?estado=`. */
export function OwnerRequestsList({ onNewRequest }: { onNewRequest?: () => void }) {
  const user = useCurrentUser()!;
  const requests = useRequestsFor({ ownerId: user.id });
  const mechanics = useApp((s) => s.db.mechanics);
  const mechanicName = (id: string) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('estado'))?.id ?? 'activas') as Tab;
  const setTab = (t: Tab) => setParams(t === 'activas' ? {} : { estado: t }, { replace: true });

  const cases = useMemo(() => groupCases(requests).map((c) => ({ ...c, status: caseStatus(c.threads) })), [requests]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, t.statuses ? cases.filter((c) => t.statuses!.includes(c.status)).length : cases.length])) as Record<Tab, number>,
    [cases],
  );
  const statuses = TABS.find((t) => t.id === tab)!.statuses;
  const visible = statuses ? cases.filter((c) => statuses.includes(c.status)) : cases;
  // Requests waiting for the owner's decision go first.
  const sorted = [...visible].sort((a, b) => Number(b.status === 'proposals_received') - Number(a.status === 'proposals_received'));

  return (
    <div>
      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="Aún no tienes solicitudes"
          description="Cuando pidas un servicio, lo verás aquí con las respuestas de los mecánicos."
          action={
            onNewRequest && (
              <button type="button" onClick={onNewRequest} className="inline-flex h-11 items-center rounded-full bg-lime px-5 font-semibold text-ink hover:bg-lime-deep">
                ¿Qué necesita tu bici?
              </button>
            )
          }
        />
      ) : (
        <>
          <TabBar tabs={TABS} value={tab} onChange={setTab} counts={counts} />
          {sorted.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-6" />} title="Nada por aquí" description="No tienes solicitudes en este estado." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sorted.map((c) => (
                <li key={c.caseId}>
                  <CaseCard threads={c.threads} mechanicName={mechanicName} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
