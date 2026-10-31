import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Hammer, Inbox } from 'lucide-react';
import type { RequestStatus, ServiceRequest } from '@/domain/types';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { RequestCard } from '@/components/domain/RequestCard';
import { EmptyState, TabBar } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ProfileButton } from '@/components/layout/QuickActions';

/** Booked work (a quote was accepted): it belongs to Servicios, the rest to Solicitudes. */
export function isBooked(r: ServiceRequest) {
  return ['confirmed', 'in_progress', 'completed'].includes(r.status) || (r.status === 'cancelled' && r.proposals.some((p) => p.status === 'accepted'));
}

interface Segment {
  id: string;
  label: string;
  match?: (r: ServiceRequest) => boolean;
}
const has = (...statuses: RequestStatus[]) => (r: ServiceRequest) => statuses.includes(r.status);

const REQUEST_SEGMENTS: Segment[] = [
  { id: 'sin-responder', label: 'Sin responder', match: has('sent', 'awaiting_proposal') },
  { id: 'respondidas', label: 'Respondidas', match: has('proposal_received') },
  { id: 'cerradas', label: 'Cerradas', match: has('cancelled', 'not_selected') },
  { id: 'todas', label: 'Todas' },
];
const SERVICE_SEGMENTS: Segment[] = [
  { id: 'proximos', label: 'Con cita', match: has('confirmed') },
  { id: 'en-curso', label: 'En curso', match: has('in_progress') },
  { id: 'completados', label: 'Completados', match: has('completed') },
  { id: 'cancelados', label: 'Cancelados', match: has('cancelled') },
  { id: 'todos', label: 'Todos' },
];

/** Old `?estado=` values keep working: they open the matching segment, on the right tab. */
const LEGACY: Record<string, string> = {
  nuevas: '/pro/solicitudes?estado=sin-responder',
  valorando: '/pro/solicitudes?estado=sin-responder',
  propuestas: '/pro/solicitudes?estado=respondidas',
  canceladas: '/pro/solicitudes?estado=cerradas',
  agenda: '/pro/trabajos?estado=proximos',
  completadas: '/pro/trabajos?estado=completados',
};

function RequestList({ title, segments, booked }: { title: string; segments: Segment[]; booked: boolean }) {
  const mechanic = useCurrentMechanic()!;
  const all = useRequestsFor({ mechanicId: mechanic.id });
  const requests = useMemo(() => all.filter((r) => isBooked(r) === booked), [all, booked]);
  const users = useApp((s) => s.db.users);
  const [params, setParams] = useSearchParams();
  const fallback = segments[0]!;
  const legacy = LEGACY[params.get('estado') ?? ''];
  const segment = segments.find((s) => s.id === params.get('estado')) ?? (booked ? segments[segments.length - 1]! : fallback);

  const counts = useMemo(
    () => Object.fromEntries(segments.map((s) => [s.id, s.match ? requests.filter(s.match).length : requests.length])) as Record<string, number>,
    [requests, segments],
  );
  if (legacy) return <Navigate to={legacy} replace />;
  const visible = segment.match ? requests.filter(segment.match) : requests;

  return (
    <>
      <ScreenHeader title={title} leading={<ProfileButton />} />
      <div className="container-page pb-8 sm:pb-10">
        <TabBar tabs={segments} value={segment.id} onChange={(id) => setParams({ estado: id }, { replace: true })} counts={counts} />
        {visible.length === 0 ? (
          <EmptyState
            icon={booked ? <Hammer className="size-6" /> : <Inbox className="size-6" />}
            title="Nada por aquí"
            description={
              booked
                ? 'Cuando un cliente acepte tu propuesta, el trabajo aparecerá aquí.'
                : 'Cuando un ciclista te elija para una solicitud, aparecerá en “Sin responder”.'
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visible.map((r) => (
              <li key={r.id}>
                <RequestCard request={r} href={`/pro/solicitudes/${r.id}`} counterpart={users.find((u) => u.id === r.ownerId)?.name ?? 'Cliente'} perspective="mechanic" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** Mechanic "Solicitudes": invitations before hiring — unanswered, answered, closed. */
export function MechanicRequestsPage() {
  return (
    <RoleGate role="mechanic">
      <RequestList title="Solicitudes" segments={REQUEST_SEGMENTS} booked={false} />
    </RoleGate>
  );
}

/** Mechanic "Servicios": contracted work — with appointment, in progress, history. */
export function MechanicWorkPage() {
  return (
    <RoleGate role="mechanic">
      <RequestList title="Servicios" segments={SERVICE_SEGMENTS} booked />
    </RoleGate>
  );
}
