import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Bike, ChevronRight, Home as HomeIcon, Plus, Store, Wrench } from 'lucide-react';
import type { BikeType, LocationId, User } from '@/domain/types';
import { bikeTypeLabel, categoryLabel, locationShort, specializationLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { searchMechanics, type MechanicResult } from '@/domain/logic/search';
import { caseHref, caseStatus, groupCases, threadHref } from '@/domain/logic/cases';
import { cyclistAttention, upcomingAppointments, type CyclistAttention } from '@/domain/logic/home';
import { formatDate, formatPrice, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useNavUi } from '@/state/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions } from '@/components/layout/QuickActions';
import { Feature, HeroWidget, Stat, Widget, WidgetGrid, heroButtonClass } from '@/components/home/Widget';
import { Avatar, DemoTag, cx } from '@/components/ui';


/** One item that only the cyclist can move forward, as a row of the attention widget. */
function AttentionRow({ item, mechanicName }: { item: CyclistAttention; mechanicName: string }) {
  const r = item.request;
  const proposal = currentProposal(r);
  const content = {
    proposal:
      item.count && item.count > 1
        ? {
            title: `${item.count} presupuestos para comparar`,
            detail: `${categoryLabel(r.category)} · Elige uno y los demás se cerrarán`,
            cta: 'Comparar presupuestos',
            to: caseHref(r),
          }
        : {
            title: `Presupuesto de ${mechanicName}`,
            detail: proposal ? `${categoryLabel(r.category)} · ${formatPrice(proposal.price)} · ${formatDate(proposal.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${proposal.time}` : categoryLabel(r.category),
            cta: 'Revisar presupuesto',
            to: caseHref(r),
          },
    clarify: {
      title: `${mechanicName} necesita aclarar algo`,
      detail: `${categoryLabel(r.category)} · Respóndele en el chat`,
      cta: 'Abrir conversación',
      to: threadHref(r),
    },
    appointment: r.appointment?.pending
      ? {
          title: `${mechanicName} propone una cita`,
          detail: `${categoryLabel(r.category)} · ${formatDate(r.appointment.pending.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${r.appointment.pending.time}`,
          cta: 'Confirmar o proponer otra',
          to: threadHref(r),
        }
      : {
          title: `Acuerda la cita con ${mechanicName}`,
          detail: `${categoryLabel(r.category)} · Servicio contratado, falta la fecha`,
          cta: 'Proponer fecha',
          to: threadHref(r),
        },
    confirm: {
      title: `${mechanicName} ha terminado el trabajo`,
      detail: item.closingSoon
        ? `${categoryLabel(r.category)} · Se cerrará automáticamente en menos de 24 h`
        : `${categoryLabel(r.category)} · Confirma que está bien o reporta un problema`,
      cta: 'Revisar y confirmar',
      to: threadHref(r),
    },
    incident: {
      title: 'Problema abierto',
      detail: `${categoryLabel(r.category)} · Con ${mechanicName}. El cierre automático está en pausa`,
      cta: 'Ver incidencia',
      to: threadHref(r),
    },
    declined: {
      title: 'Ningún mecánico ha podido atenderte',
      detail: `${categoryLabel(r.category)} · Invita a otros mecánicos a esta solicitud`,
      cta: 'Invitar a otros',
      to: caseHref(r),
    },
    review: {
      title: `¿Qué tal con ${mechanicName}?`,
      detail: `${categoryLabel(r.category)} · Servicio completado`,
      cta: 'Valorar el servicio',
      to: threadHref(r),
    },
  }[item.kind];
  const urgent = item.kind !== 'review' && item.kind !== 'declined';
  return (
    <li>
      <Link to={content.to} className="flex items-center gap-3 py-3 hover:opacity-80" data-testid={`attention-${item.kind}`}>
        <span className={cx('size-2.5 shrink-0 rounded-full', urgent ? 'bg-lime ring-2 ring-ink' : 'bg-line-strong')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{content.title}</span>
          <span className="mt-0.5 block text-sm text-muted">{content.detail}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
            {content.cta} <ArrowRight className="size-4" aria-hidden />
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Why this mechanic is suggested, only from facts in their profile. */
function reasonsFor(result: MechanicResult, location?: LocationId, bikeType?: BikeType): string[] {
  const m = result.mechanic;
  const reasons: string[] = [];
  if (location && result.coversLocation) reasons.push(`Cubre ${locationShort(location)}`);
  if (bikeType && m.bikeTypes.includes(bikeType)) reasons.push(`Trabaja con ${bikeTypeLabel(bikeType).toLowerCase()}`);
  if (m.specializations[0]) reasons.push(`Especialista en ${specializationLabel(m.specializations[0]).toLowerCase()}`);
  return reasons.slice(0, 2);
}

/** Discover: a few relevant professionals, with grounded reasons and no invented ratings. */
function DiscoverWidget({ user }: { user: User | null }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const bikes = useOwnerBikes(user?.id);
  const location = user?.location;
  const bikeType = bikes[0]?.type;
  const picks = useMemo(() => {
    // Never suggest the account's own workshop (accounts can be both cyclist and mechanic).
    const others = mechanics.filter((m) => m.id !== user?.mechanicId);
    const near = searchMechanics(others, reviews, { location, bikeType });
    const rest = searchMechanics(others, reviews, {}).filter((r) => !near.some((n) => n.mechanic.id === r.mechanic.id));
    return [...near, ...rest].slice(0, 3);
  }, [mechanics, reviews, location, bikeType, user?.mechanicId]);

  return (
    <Widget title={location ? 'Mecánicos cerca de ti' : 'Mecánicos'} to="/mecanicos" wide testId="discover" className="lg:order-last">
      <Feature icon={Wrench} title="Descubre profesionales" subtitle="Talleres y mecánicos a domicilio" />
      <ul className="mt-4 space-y-3 border-t border-line pt-4">
        {picks.map((r) => {
          const m = r.mechanic;
          const reasons = reasonsFor(r, location, bikeType);
          return (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.name} tone={m.avatarTone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">{m.name}</span>
                  <DemoTag />
                </span>
                <span className="block truncate text-sm text-muted">{reasons.join(' · ') || m.headline}</span>
              </span>
              <span className="flex shrink-0 gap-1.5 text-muted">
                {m.workshop && <Store className="size-4" aria-label="Taller" />}
                {m.homeService && <HomeIcon className="size-4" aria-label="A domicilio" />}
              </span>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

const shortDate = (d: string) => formatDate(d, { day: 'numeric', month: 'short' }).replace('.', '');

function CyclistHome({ user }: { user: User | null }) {
  const requests = useRequestsFor({ ownerId: user?.id ?? '__guest__' });
  const reviews = useApp((s) => s.db.reviews);
  const mechanics = useApp((s) => s.db.mechanics);
  const bikes = useOwnerBikes(user?.id);
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  const name = (id: string) => mechanics.find((m) => m.id === id)?.name ?? 'El mecánico';
  const first = (id: string) => name(id).split(' ')[0];
  const attention = useMemo(() => cyclistAttention(requests, reviews), [requests, reviews]);
  const statuses = useMemo(() => groupCases(requests).map((c) => caseStatus(c.threads)), [requests]);
  const active = statuses.filter((c) => c === 'searching' || c === 'proposals_received' || c === 'booked').length;
  const quotes = attention.filter((a) => a.kind === 'proposal').reduce((n, a) => n + (a.count ?? 1), 0);
  const today = toISODate(new Date());
  const next = useMemo(() => upcomingAppointments(requests).find((r) => r.appointment!.confirmed!.date >= today), [requests, today]);
  const toSchedule = requests.find((r) => r.status === 'confirmed' && !r.appointment?.confirmed);

  return (
    <WidgetGrid>
      {/* 1 · Primary intent. The + in the bar opens the same sheet from anywhere. */}
      <HeroWidget
        testId="widget-need"
        label="¿Qué necesita tu bici?"
        icon={Wrench}
        headline={requests.length === 0 ? 'Encuentra al mecánico adecuado.' : 'Pide otro servicio cuando lo necesites.'}
        action={
          <button type="button" onClick={openNewRequest} className={heroButtonClass}>
            <Plus className="size-5" aria-hidden /> Nueva solicitud
          </button>
        }
      />

      {/* 2 · Only what needs the cyclist now. */}
      {attention.length > 0 && (
        <Widget title="Requiere tu atención" wide testId="attention">
          <ul className="mt-1 divide-y divide-line">
            {attention.slice(0, 4).map((item) => (
              <AttentionRow key={`${item.kind}-${item.request.id}`} item={item} mechanicName={name(item.request.mechanicId)} />
            ))}
          </ul>
        </Widget>
      )}

      {/* 3 · Summary: requests and the next appointment. */}
      <Widget title="Solicitudes" to="/solicitudes" testId="widget-requests">
        {quotes > 0 ? (
          <Stat value={quotes} caption={quotes === 1 ? 'Presupuesto por revisar' : 'Presupuestos por revisar'} accent />
        ) : (
          <Stat value={active} caption={active === 0 ? 'Ninguna activa' : active === 1 ? 'Activa' : 'Activas'} />
        )}
      </Widget>

      <Widget title="Próxima cita" to={next ? threadHref(next) : toSchedule ? threadHref(toSchedule) : '/solicitudes'} testId="widget-appointment">
        {next ? (
          <Stat small value={shortDate(next.appointment!.confirmed!.date)} caption={`${next.appointment!.confirmed!.time} · ${categoryLabel(next.category)} con ${first(next.mechanicId)}`} />
        ) : toSchedule ? (
          <Stat small value="Por acordar" caption={`${categoryLabel(toSchedule.category)} con ${first(toSchedule.mechanicId)}`} accent />
        ) : (
          <Stat small value="—" caption="Sin citas por ahora" />
        )}
      </Widget>

      {/* 4 · Discovery and the garage. */}
      <DiscoverWidget user={user} />

      <Widget title="Mi garaje" to="/garaje" wide testId="widget-garage">
        <Feature
          icon={Bike}
          title={bikes.length === 0 ? 'Añade tu bici' : bikes.length === 1 ? bikes[0]!.name : `${bikes.length} bicicletas`}
          subtitle={bikes.length === 0 ? 'Guarda sus datos para pedir servicios más rápido' : 'Historial y reparaciones'}
        />
      </Widget>
    </WidgetGrid>
  );
}

/**
 * Cyclist Home as a grid of widgets: the request entry first; then only what needs the
 * person, a summary of requests and the next appointment, a few relevant mechanics and the
 * garage. New accounts and guests see the request entry, empty summaries and discovery.
 */
export function HomePage() {
  const user = useCurrentUser();
  const mode = useMode();
  // Mechanic mode has its own Home.
  if (user && mode === 'mechanic') return <Navigate to="/pro" replace />;
  return (
    <>
      <ScreenHeader title="Inicio" actions={<CyclistHeaderActions />} />
      <div className="container-page pb-8">
        <CyclistHome user={user} />
      </div>
    </>
  );
}
