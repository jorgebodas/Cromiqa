import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import type { RequestStatus } from '@/domain/types';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { RequestCard } from '@/components/domain/RequestCard';
import { EmptyState, TabBar } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

type Tab = 'nuevas' | 'valorando' | 'propuestas' | 'agenda' | 'completadas' | 'canceladas' | 'todas';
const TABS: { id: Tab; label: string; statuses?: RequestStatus[] }[] = [
  { id: 'nuevas', label: 'Nuevas', statuses: ['sent'] },
  { id: 'valorando', label: 'Por proponer', statuses: ['awaiting_proposal'] },
  { id: 'propuestas', label: 'Propuestas enviadas', statuses: ['proposal_received'] },
  { id: 'agenda', label: 'Agenda', statuses: ['confirmed', 'in_progress'] },
  { id: 'completadas', label: 'Completadas', statuses: ['completed'] },
  { id: 'canceladas', label: 'Canceladas', statuses: ['cancelled'] },
  { id: 'todas', label: 'Todas' },
];

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const requests = useRequestsFor({ mechanicId: mechanic.id });
  const users = useApp((s) => s.db.users);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('estado'))?.id ?? 'todas') as Tab;

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, t.statuses ? requests.filter((r) => t.statuses!.includes(r.status)).length : requests.length])) as Record<Tab, number>,
    [requests],
  );
  const statuses = TABS.find((t) => t.id === tab)?.statuses;
  const visible = statuses ? requests.filter((r) => statuses.includes(r.status)) : requests;

  return (
    <>
      <ScreenHeader title="Solicitudes" />
      <div className="container-page pb-8 sm:pb-10">
      <TabBar tabs={TABS} value={tab} onChange={(t) => setParams(t === 'todas' ? {} : { estado: t }, { replace: true })} counts={counts} />
      {visible.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="No hay solicitudes aquí" description="Cuando un cliente te envíe una solicitud aparecerá en “Nuevas”." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <li key={r.id}>
              <RequestCard
                request={r}
                href={`/pro/solicitudes/${r.id}`}
                counterpart={users.find((u) => u.id === r.ownerId)?.name ?? 'Cliente'}
                perspective="mechanic"
              />
            </li>
          ))}
        </ul>
      )}
      </div>
    </>
  );
}

export function MechanicRequestsPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
