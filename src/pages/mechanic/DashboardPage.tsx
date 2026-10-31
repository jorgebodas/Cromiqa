import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, ChevronRight, Hammer, Inbox, MapPin, Pencil, ShieldCheck } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { categoryLabel, locationShort } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { mechanicAttention, mechanicCounts, profileGaps, profileStatus, upcomingAppointments, type MechanicAttention, type ProfileGap } from '@/domain/logic/home';
import { formatDate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ProfileButton } from '@/components/layout/QuickActions';
import { cx } from '@/components/ui';

function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ACTION: Record<MechanicAttention['kind'], { verb: string; cta: string }> = {
  respond: { verb: 'Nueva solicitud de', cta: 'Responder' },
  message: { verb: 'Mensaje de', cta: 'Contestar' },
  propose: { verb: 'Envía tu propuesta a', cta: 'Preparar propuesta' },
  start: { verb: 'Hoy toca el servicio de', cta: 'Empezar trabajo' },
  finish: { verb: 'Trabajo en curso para', cta: 'Marcar como terminado' },
};

function Section({ title, action, children, testId }: { title: string; action?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section aria-label={title} data-testid={testId}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-[19px] font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Count({ label, value, to, icon: Icon, testId }: { label: string; value: number; to: string; icon: typeof Inbox; testId: string }) {
  return (
    <Link to={to} className={cx('surface flex flex-col gap-2 p-4', value > 0 && 'ring-2 ring-ink')} data-testid={testId}>
      <Icon className="size-5 text-muted" aria-hidden />
      <span className="font-display text-[32px] font-bold leading-none tracking-tight">{value}</span>
      <span className="text-sm font-medium leading-tight text-muted">{label}</span>
    </Link>
  );
}

const GAP_TEXT: Record<ProfileGap, { label: string; to: string }> = {
  presentation: { label: 'Completa tu presentación', to: '/pro/perfil' },
  services: { label: 'Publica tus servicios y tarifas', to: '/pro/servicios' },
  coverage: { label: 'Indica dónde trabajas', to: '/pro/perfil' },
  availability: { label: 'Configura tu disponibilidad', to: '/pro/disponibilidad' },
};

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const requests = useRequestsFor({ mechanicId: mechanic.id });
  const users = useApp((s) => s.db.users);
  const client = (r: ServiceRequest) => users.find((u) => u.id === r.ownerId)?.name ?? 'Cliente';
  const attention = useMemo(() => mechanicAttention(requests), [requests]);
  const counts = useMemo(() => mechanicCounts(requests), [requests]);
  const upcoming = useMemo(() => upcomingAppointments(requests).slice(0, 4), [requests]);
  const gaps = profileGaps(mechanic);
  const status = profileStatus(mechanic);

  return (
    <>
      <ScreenHeader title="Inicio" description={todayLabel()} leading={<ProfileButton />} />
      <div className="container-page pb-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-6">
            {/* 1 · What needs you now, most urgent first. */}
            <Section title="Requiere tu atención" testId="mechanic-attention">
              {attention.length === 0 ? (
                <p className="surface p-5 text-[15px] text-muted">
                  {requests.length === 0
                    ? 'Aún no has recibido solicitudes. Cuando un ciclista te elija, aparecerá aquí.'
                    : 'Estás al día. No hay nada pendiente por tu parte.'}
                </p>
              ) : (
                <ul className="surface divide-y divide-line overflow-hidden">
                  {attention.map(({ kind, request: r }) => (
                    <li key={`${kind}-${r.id}`}>
                      <Link to={`/pro/solicitudes/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60" data-testid={`todo-${kind}`}>
                        <span className={cx('size-2 shrink-0 rounded-full', kind === 'respond' || kind === 'message' ? 'bg-lime ring-2 ring-ink' : 'bg-line-strong')} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {ACTION[kind].verb} {client(r).split(' ')[0]}
                          </span>
                          <span className="block truncate text-sm text-muted">
                            {categoryLabel(r.category)} · {r.bike.brand} {r.bike.model}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold">{ACTION[kind].cta}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* 2 · Counts that lead to the filtered list. */}
            <div className="grid grid-cols-3 gap-3">
              <Count label="Sin responder" value={counts.unanswered} to="/pro/solicitudes?estado=sin-responder" icon={Inbox} testId="count-unanswered" />
              <Count label="Con cita" value={counts.withAppointment} to="/pro/trabajos?estado=proximos" icon={CalendarCheck} testId="count-appointments" />
              <Count label="En curso" value={counts.active} to="/pro/trabajos?estado=en-curso" icon={Hammer} testId="count-active" />
            </div>

            {/* 3 · Upcoming confirmed work. */}
            {upcoming.length > 0 && (
              <Section title="Próximas citas" action={<Link to="/pro/trabajos" className="text-sm font-semibold hover:underline">Ver todas</Link>}>
                <ul className="surface divide-y divide-line overflow-hidden">
                  {upcoming.map((r) => {
                    const p = currentProposal(r)!;
                    return (
                      <li key={r.id}>
                        <Link to={`/pro/solicitudes/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60">
                          <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-canvas py-1.5 text-center">
                            <span className="text-[11px] font-semibold uppercase text-muted">{formatDate(p.date, { month: 'short' }).replace('.', '')}</span>
                            <span className="font-display text-lg font-bold leading-none">{formatDate(p.date, { day: 'numeric' })}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {p.time} · {client(r)}
                            </span>
                            <span className="flex items-center gap-1 truncate text-sm text-muted">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              {r.mode === 'home' ? 'A domicilio' : 'En taller'} · {locationShort(r.location)}
                            </span>
                          </span>
                          {r.status === 'in_progress' && <span className="shrink-0 rounded-full bg-lime px-2.5 py-1 text-xs font-semibold text-ink">En curso</span>}
                          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </div>

          {/* 4 · Professional profile status. */}
          <Section title="Tu perfil profesional" testId="profile-status">
            <div className="surface p-4 sm:p-5">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className={cx('size-5', status === 'active' ? 'text-lime-text' : 'text-muted')} aria-hidden />
                {status === 'active' ? 'Activo · revisado (demo)' : status === 'pending_verification' ? 'Pendiente de verificación' : 'Incompleto'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {status === 'active'
                  ? 'Los ciclistas pueden encontrarte y enviarte solicitudes.'
                  : status === 'pending_verification'
                    ? 'Tu perfil está completo. Lo revisaremos antes de mostrarlo como verificado.'
                    : 'Completa estos pasos para que los ciclistas puedan encontrarte.'}
              </p>
              {gaps.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {gaps.map((g) => (
                    <li key={g}>
                      <Link to={GAP_TEXT[g].to} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm font-semibold">
                        {GAP_TEXT[g].label} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-sm font-semibold">
                <Link to={`/mecanicos/${mechanic.id}`} className="hover:underline">Ver perfil público</Link>
                <span className="text-subtle" aria-hidden>·</span>
                <Link to="/pro/perfil" className="inline-flex items-center gap-1 hover:underline">
                  <Pencil className="size-3.5" aria-hidden /> Editar
                </Link>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/**
 * Mechanic Home, action-first: the to-do list by urgency, counts that open the filtered
 * lists, upcoming appointments, and the professional profile's status and missing steps.
 */
export function DashboardPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
