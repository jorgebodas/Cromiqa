import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { RequestStatus } from '@/domain/types';
import { useApp } from '@/state/store';
import { ACTIVE_STATUSES, useCurrentUser, useRequestsFor } from '@/state/selectors';
import { RequestCard } from '@/components/domain/RequestCard';
import { EmptyState, TabBar } from '@/components/ui';

type Tab = 'active' | 'completed' | 'cancelled' | 'all';
const TABS: { id: Tab; label: string; statuses?: RequestStatus[] }[] = [
  { id: 'active', label: 'Activas', statuses: ACTIVE_STATUSES },
  { id: 'completed', label: 'Completadas', statuses: ['completed'] },
  { id: 'cancelled', label: 'Canceladas', statuses: ['cancelled'] },
  { id: 'all', label: 'Todas' },
];

/** The owner's requests with status filters. Shown in Actividad → Solicitudes. */
export function OwnerRequestsList({ onNewRequest }: { onNewRequest?: () => void }) {
  const user = useCurrentUser()!;
  const requests = useRequestsFor({ ownerId: user.id });
  const mechanics = useApp((s) => s.db.mechanics);
  const [tab, setTab] = useState<Tab>('active');

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, t.statuses ? requests.filter((r) => t.statuses!.includes(r.status)).length : requests.length])) as Record<Tab, number>,
    [requests],
  );
  const statuses = TABS.find((t) => t.id === tab)!.statuses;
  const visible = statuses ? requests.filter((r) => statuses.includes(r.status)) : requests;
  // Requests waiting for the owner's decision go first.
  const sorted = [...visible].sort((a, b) => Number(b.status === 'proposal_received') - Number(a.status === 'proposal_received'));

  return (
    <div>
      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title="Aún no tienes solicitudes"
          description="Cuando pidas un servicio a un mecánico, lo verás aquí con su estado y la propuesta."
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
              {sorted.map((r) => (
                <li key={r.id}>
                  <RequestCard request={r} href={`/solicitudes/${r.id}`} counterpart={mechanics.find((m) => m.id === r.mechanicId)?.name ?? 'Mecánico'} perspective="owner" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
