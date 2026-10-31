import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CheckCheck, Eye, Inbox, Pencil, Send } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { currentProposal } from '@/domain/logic/requests';
import { formatLongDate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useMechanicRating, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { RequestCard } from '@/components/domain/RequestCard';
import { Avatar, Card, EmptyState, LinkButton, Rating, SectionTitle, cx } from '@/components/ui';
import { DemoVerifiedBadge, ModeIndicators } from '@/components/domain/MechanicCard';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function Stat({ label, value, icon: Icon, highlight, to }: { label: string; value: number; icon: typeof Inbox; highlight?: boolean; to: string }) {
  return (
    <Link to={to} className={cx('rounded-2xl border p-4 transition-colors hover:border-ink', highlight && value > 0 ? 'border-ink' : 'border-line')}>
      <span className="flex items-center justify-between text-sm text-muted">
        {label}
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="mt-2 flex items-center gap-2 font-display text-3xl font-extrabold">
        {value}
        {highlight && value > 0 && <span className="size-2 rounded-full bg-lime ring-2 ring-ink" aria-hidden />}
      </span>
    </Link>
  );
}

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const requests = useRequestsFor({ mechanicId: mechanic.id });
  const users = useApp((s) => s.db.users);
  const { rating, reviewCount } = useMechanicRating(mechanic.id);
  const ownerName = (r: ServiceRequest) => users.find((u) => u.id === r.ownerId)?.name ?? 'Cliente';

  const incoming = requests.filter((r) => r.status === 'sent' || r.status === 'awaiting_proposal');
  const sentProposals = requests.filter((r) => r.status === 'proposal_received');
  const upcoming = requests
    .filter((r) => r.status === 'confirmed' || r.status === 'in_progress')
    .sort((a, b) => (currentProposal(a)?.date ?? '').localeCompare(currentProposal(b)?.date ?? ''));
  const completed = requests.filter((r) => r.status === 'completed').slice(0, 3);

  return (
    <>
      <ScreenHeader title="Panel" description={`Hola, ${mechanic.name.split(' ')[0]}. Esto es lo que tienes pendiente hoy.`} />
      <div className="container-page pb-8 sm:pb-10">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevas" value={requests.filter((r) => r.status === 'sent').length} icon={Inbox} highlight to="/pro/solicitudes?estado=nuevas" />
        <Stat label="Por proponer" value={requests.filter((r) => r.status === 'awaiting_proposal').length} icon={Pencil} highlight to="/pro/solicitudes?estado=valorando" />
        <Stat label="Propuestas enviadas" value={sentProposals.length} icon={Send} to="/pro/solicitudes?estado=propuestas" />
        <Stat label="Próximos servicios" value={upcoming.length} icon={CalendarCheck} to="/pro/solicitudes?estado=agenda" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="incoming">
            <SectionTitle id="incoming" action={<Link to="/pro/solicitudes" className="text-sm font-semibold hover:underline">Ver todas</Link>}>
              Necesitan tu respuesta
            </SectionTitle>
            {incoming.length === 0 ? (
              <EmptyState icon={<CheckCheck className="size-6" />} title="Estás al día" description="No tienes solicitudes pendientes de respuesta." />
            ) : (
              <ul className="space-y-3">
                {incoming.map((r) => (
                  <li key={r.id}>
                    <RequestCard request={r} href={`/pro/solicitudes/${r.id}`} counterpart={ownerName(r)} perspective="mechanic" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="upcoming">
            <SectionTitle id="upcoming">Próximos servicios</SectionTitle>
            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted">No hay servicios agendados.</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {upcoming.map((r) => {
                  const p = currentProposal(r);
                  return (
                    <li key={r.id}>
                      <Link to={`/pro/solicitudes/${r.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-sand/60">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold first-letter:uppercase">
                            {p ? `${formatLongDate(p.date)} · ${p.time}` : 'Fecha por concretar'}
                          </span>
                          <span className="block truncate text-sm text-muted">
                            {ownerName(r)} · {r.bike.brand} {r.bike.model} · {r.mode === 'home' ? 'A domicilio' : 'En taller'}
                          </span>
                        </span>
                        <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', r.status === 'in_progress' ? 'bg-lime text-ink' : 'bg-ink text-paper')}>
                          {r.status === 'in_progress' ? 'En curso' : 'Confirmada'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="done">
            <SectionTitle id="done">Completados recientemente</SectionTitle>
            {completed.length === 0 ? (
              <p className="text-sm text-muted">Aún no hay trabajos completados.</p>
            ) : (
              <ul className="space-y-3">
                {completed.map((r) => (
                  <li key={r.id}>
                    <RequestCard request={r} href={`/pro/solicitudes/${r.id}`} counterpart={ownerName(r)} perspective="mechanic" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={mechanic.name} tone={mechanic.avatarTone} size="lg" />
              <div className="min-w-0">
                <p className="font-bold">{mechanic.businessName}</p>
                <p className="text-sm text-muted">{mechanic.headline}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Rating rating={rating} count={reviewCount} />
              <DemoVerifiedBadge verified={mechanic.demoVerified} />
              <ModeIndicators home={mechanic.homeService} workshop={mechanic.workshop} compact />
            </div>
            <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
              {mechanic.services.length} servicios publicados · {mechanic.serviceAreas.length} zonas
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <LinkButton to={`/mecanicos/${mechanic.id}`} variant="secondary" size="sm" icon={<Eye className="size-4" aria-hidden />}>
                Ver público
              </LinkButton>
              <LinkButton to="/pro/perfil" variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />}>
                Editar
              </LinkButton>
            </div>
          </Card>
          <Link to="/pro/disponibilidad" className="flex items-center justify-between rounded-2xl border border-line p-4 text-sm hover:border-ink">
            <span>
              <span className="block font-semibold">Disponibilidad</span>
              <span className="text-muted">{mechanic.availabilityNote}</span>
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </aside>
      </div>
      </div>
    </>
  );
}

export function DashboardPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
