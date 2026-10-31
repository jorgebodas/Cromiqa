import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Hammer, MapPin, Pencil, ShieldCheck } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { categoryLabel, locationShort } from '@/domain/catalog';
import { mechanicAttention, mechanicCounts, profileGaps, profileStatus, upcomingAppointments, type MechanicAttention, type ProfileGap } from '@/domain/logic/home';
import { formatDate, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Feature, HeroWidget, Stat, Widget, WidgetGrid, heroButtonClass } from '@/components/home/Widget';
import { cx } from '@/components/ui';

function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ACTION: Record<MechanicAttention['kind'], { verb: string; cta: string }> = {
  respond: { verb: 'Nueva solicitud de', cta: 'Responder' },
  message: { verb: 'Mensaje de', cta: 'Contestar' },
  incident: { verb: 'Problema reportado por', cta: 'Ver incidencia' },
  propose: { verb: 'Envía tu presupuesto a', cta: 'Preparar presupuesto' },
  appointment: { verb: 'Acuerda la cita con', cta: 'Coordinar cita' },
  start: { verb: 'Hoy toca el servicio de', cta: 'Empezar trabajo' },
  finish: { verb: 'Trabajo en curso para', cta: 'Marcar como terminado' },
};

const GAP_TEXT: Record<ProfileGap, { label: string; to: string }> = {
  presentation: { label: 'Completa tu presentación', to: '/pro/perfil' },
  services: { label: 'Publica tus servicios y tarifas', to: '/pro/servicios' },
  coverage: { label: 'Indica dónde trabajas', to: '/pro/perfil' },
  availability: { label: 'Configura tu disponibilidad', to: '/pro/disponibilidad' },
};

const shortDate = (d: string) => formatDate(d, { day: 'numeric', month: 'short' }).replace('.', '');
const URGENT: MechanicAttention['kind'][] = ['respond', 'message', 'incident'];

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const requests = useRequestsFor({ mechanicId: mechanic.id });
  const users = useApp((s) => s.db.users);
  const client = (r: ServiceRequest) => users.find((u) => u.id === r.ownerId)?.name ?? 'Cliente';
  const attention = useMemo(() => mechanicAttention(requests), [requests]);
  const counts = useMemo(() => mechanicCounts(requests), [requests]);
  const today = toISODate(new Date());
  const upcoming = useMemo(() => upcomingAppointments(requests).filter((r) => r.appointment!.confirmed!.date >= today), [requests, today]);
  const next = upcoming[0];
  const gaps = profileGaps(mechanic);
  const status = profileStatus(mechanic);

  const approve = useApp((s) => s.approveProfessionalProfile);
  const toast = useApp((s) => s.toast);
  const hero =
    status === 'pending_verification'
      ? { headline: 'Tu perfil está en revisión.', label: 'Revisar mi perfil', to: '/pro/perfil' }
      : requests.length === 0
      ? { headline: 'Aún no has recibido solicitudes.', label: gaps.length ? 'Completar perfil' : 'Ver perfil público', to: gaps.length ? GAP_TEXT[gaps[0]!].to : `/mecanicos/${mechanic.id}` }
      : counts.unanswered > 0
        ? {
            headline: counts.unanswered === 1 ? 'Tienes 1 solicitud sin responder.' : `Tienes ${counts.unanswered} solicitudes sin responder.`,
            label: 'Responder solicitudes',
            to: '/pro/solicitudes?estado=sin-responder',
          }
        : attention.length > 0
          ? { headline: 'Tienes tareas pendientes en tus servicios.', label: 'Ver servicios', to: '/pro/trabajos' }
          : { headline: 'Estás al día. Nada pendiente por tu parte.', label: 'Ver servicios', to: '/pro/trabajos' };

  return (
    <>
      <ScreenHeader title="Inicio" description={todayLabel()} />
      <div className="container-page pb-8">
        <WidgetGrid>
          {/* 1 · Where the day stands, with the one action that matters most. */}
          <HeroWidget
            testId="mechanic-hero"
            label="Tu taller hoy"
            icon={Hammer}
            headline={hero.headline}
            action={
              <Link to={hero.to} className={heroButtonClass}>
                {hero.label} <ArrowRight className="size-5" aria-hidden />
              </Link>
            }
          />

          {/* 2 · Counts that open the filtered lists, and the next appointment. */}
          <Widget title="Sin responder" to="/pro/solicitudes?estado=sin-responder" testId="count-unanswered">
            <Stat value={counts.unanswered} caption={counts.unanswered === 1 ? 'Solicitud nueva' : 'Solicitudes nuevas'} accent={counts.unanswered > 0} />
          </Widget>
          <Widget title="Próxima cita" to={next ? `/pro/solicitudes/${next.id}` : '/pro/trabajos?estado=proximos'} testId="widget-appointment">
            {next ? (
              <Stat small value={shortDate(next.appointment!.confirmed!.date)} caption={`${next.appointment!.confirmed!.time} · ${client(next).split(' ')[0]} · ${next.mode === 'home' ? 'a domicilio' : 'en taller'}`} />
            ) : (
              <Stat small value="—" caption="Sin citas confirmadas" />
            )}
          </Widget>

          {/* 3 · The to-do list by urgency. */}
          {attention.length > 0 && (
            <Widget title="Requiere tu atención" wide testId="mechanic-attention">
              <ul className="mt-1 divide-y divide-line">
                {attention.slice(0, 5).map(({ kind, request: r }) => (
                  <li key={`${kind}-${r.id}`}>
                    <Link to={`/pro/solicitudes/${r.id}`} className="flex items-center gap-3 py-3 hover:opacity-80" data-testid={`todo-${kind}`}>
                      <span className={cx('size-2.5 shrink-0 rounded-full', URGENT.includes(kind) ? 'bg-lime ring-2 ring-ink' : 'bg-line-strong')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {ACTION[kind].verb} {client(r).split(' ')[0]}
                        </span>
                        <span className="block truncate text-sm text-muted">
                          {categoryLabel(r.category)} · {r.bike.brand} {r.bike.model}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-sm font-semibold sm:inline">{ACTION[kind].cta}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Widget>
          )}

          <Widget title="Por agendar" to="/pro/trabajos?estado=por-agendar" testId="count-appointments">
            <Stat value={counts.withAppointment} caption="Citas por acordar" accent={counts.withAppointment > 0} />
          </Widget>
          <Widget title="En curso" to="/pro/trabajos?estado=en-curso" testId="count-active">
            <Stat value={counts.active} caption={counts.active === 1 ? 'Trabajo' : 'Trabajos'} />
          </Widget>

          {/* 4 · Upcoming confirmed work, when there's more than the next one. */}
          {upcoming.length > 1 && (
            <Widget title="Próximas citas" to="/pro/trabajos?estado=proximos" linkHeader wide testId="upcoming">
              <ul className="mt-2 divide-y divide-line">
                {upcoming.slice(0, 4).map((r) => {
                  const a = r.appointment!.confirmed!;
                  return (
                    <li key={r.id}>
                      <Link to={`/pro/solicitudes/${r.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-canvas py-1.5 text-center">
                          <span className="text-[11px] font-semibold uppercase text-muted">{formatDate(a.date, { month: 'short' }).replace('.', '')}</span>
                          <span className="font-display text-lg font-bold leading-none">{formatDate(a.date, { day: 'numeric' })}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {a.time} · {client(r)}
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
            </Widget>
          )}

          {/* 5 · Professional profile status and missing steps. */}
          <Widget title="Perfil profesional" to="/pro/perfil" linkHeader wide testId="profile-status">
            <Feature
              icon={ShieldCheck}
              title={status === 'active' ? 'Activo · revisado (demo)' : status === 'pending_verification' ? 'Pendiente de verificación' : 'Incompleto'}
              subtitle={
                status === 'active'
                  ? 'Los ciclistas pueden encontrarte y enviarte solicitudes.'
                  : status === 'pending_verification'
                    ? 'Lo revisaremos antes de publicarlo. Hasta entonces no apareces en las búsquedas ni recibes solicitudes.'
                    : 'Completa estos pasos para que los ciclistas puedan encontrarte.'
              }
            />
            {gaps.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {gaps.map((g) => (
                  <li key={g}>
                    <Link to={GAP_TEXT[g].to} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm font-semibold">
                      {GAP_TEXT[g].label} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {status === 'pending_verification' && (
              <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-3" data-testid="demo-approve">
                <p className="text-sm text-muted">Modo demo: en Cromiqa real lo revisaría el equipo. Aquí puedes simularlo.</p>
                <button
                  type="button"
                  onClick={async () => {
                    await approve(mechanic.id);
                    toast('Perfil aprobado (demo). Ya apareces en las búsquedas.');
                  }}
                  className="mt-2 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-soft"
                >
                  Simular aprobación (demo)
                </button>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-sm font-semibold">
              <Link to={`/mecanicos/${mechanic.id}`} className="hover:underline">
                Ver perfil público
              </Link>
              <span className="text-subtle" aria-hidden>
                ·
              </span>
              <Link to="/pro/perfil" className="inline-flex items-center gap-1 hover:underline">
                <Pencil className="size-3.5" aria-hidden /> Editar
              </Link>
            </div>
          </Widget>
        </WidgetGrid>
      </div>
    </>
  );
}

/**
 * Mechanic Home as a grid of widgets: where the day stands with its main action, counts that
 * open the filtered lists, the next appointment, the to-do list by urgency, upcoming work and
 * the professional profile's status.
 */
export function DashboardPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
