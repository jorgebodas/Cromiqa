import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bike, ChevronRight, Home as HomeIcon, Mic, Search, Store, Wrench } from 'lucide-react';
import type { BikeType, LocationId, User } from '@/domain/types';
import { bikeTypeLabel, categoryLabel, locationShort, serviceLabel, specializationLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { searchMechanics, type MechanicResult } from '@/domain/logic/search';
import { requestHref, requestStage } from '@/domain/logic/cases';
import { attentionHref, homeAttention, upcomingAppointments, type CyclistAttention } from '@/domain/logic/home';
import { formatDate, formatPrice, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useNavUi } from '@/state/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions } from '@/components/layout/QuickActions';
import { Feature, Stat, Widget, WidgetGrid } from '@/components/home/Widget';
import { ServiceCarousel } from '@/components/home/ServiceCarousel';
import { Avatar, DemoTag } from '@/components/ui';


/** One item that only the cyclist can move forward, as a row of the attention widget. */
function AttentionRow({ item, mechanicName }: { item: CyclistAttention; mechanicName: string }) {
  const r = item.request;
  const proposal = currentProposal(r);
  const content = {
    proposal: {
      title: proposal ? `${mechanicName} · ${formatPrice(proposal.price)}` : `Presupuesto de ${mechanicName}`,
      detail: proposal ? `Presupuesto · ${formatDate(proposal.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : serviceLabel(r),
    },
    clarify: {
      title: `${mechanicName} necesita aclarar algo`,
      detail: `${categoryLabel(r.category)} · Respóndele en el chat`,
    },
    appointment: r.appointment?.pending
      ? {
          title: `${mechanicName} propone una cita`,
          detail: `${categoryLabel(r.category)} · ${formatDate(r.appointment.pending.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${r.appointment.pending.time}`,
        }
      : {
          title: `Acuerda la cita con ${mechanicName}`,
          detail: `${categoryLabel(r.category)} · Servicio contratado, falta la fecha`,
        },
    confirm: {
      title: `${mechanicName} ha terminado el trabajo`,
      detail: item.closingSoon
        ? `${categoryLabel(r.category)} · Se cerrará automáticamente en menos de 24 h`
        : `${categoryLabel(r.category)} · Confirma que está bien o reporta un problema`,
    },
    incident: {
      title: 'Problema abierto',
      detail: `${categoryLabel(r.category)} · Con ${mechanicName}. El cierre automático está en pausa`,
    },
    declined: {
      title: `${mechanicName} no ha podido atenderte`,
      detail: `${serviceLabel(r)} · Puedes pedírselo a otro mecánico con una nueva solicitud`,
    },
    review: {
      title: `¿Qué tal con ${mechanicName}?`,
      detail: `${categoryLabel(r.category)} · Servicio completado`,
    },
  }[item.kind];
  return (
    <li>
      <Link to={attentionHref(item)} className="flex min-h-16 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-black/[0.03]" data-testid={`attention-${item.kind}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug">{content.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug opacity-70">{content.detail}</span>
        </span>
        <ChevronRight className="size-[18px] shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

/** What needs the cyclist: the decisions in lime (the one lime surface of Home), then gentle nudges. */
function AttentionSection({ items, name }: { items: CyclistAttention[]; name: (id: string) => string }) {
  const urgent = items.filter((i) => i.kind !== 'review' && i.kind !== 'declined').slice(0, 4);
  const later = items.filter((i) => i.kind === 'review' || i.kind === 'declined').slice(0, 2);
  return (
    <section aria-label="Te toca a ti" className="space-y-6" data-testid="attention">
      {urgent.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-[19px] font-bold tracking-tight">Te toca decidir</h2>
          <ul className="action-fill lifted divide-y divide-ink/10 overflow-hidden">
            {urgent.map((item) => (
              <AttentionRow key={`${item.kind}-${item.request.id}`} item={item} mechanicName={name(item.request.mechanicId)} />
            ))}
          </ul>
        </div>
      )}
      {later.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-[19px] font-bold tracking-tight">Cuando puedas</h2>
          <ul className="surface divide-y divide-line overflow-hidden">
            {later.map((item) => (
              <AttentionRow key={`${item.kind}-${item.request.id}`} item={item} mechanicName={name(item.request.mechanicId)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** A tap target that reads as a search field: it opens the usual new-request flow. */
function AskBar() {
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  const resetDraft = useApp((s) => s.resetDraft);
  return (
    <button
      type="button"
      onClick={() => {
        resetDraft({});
        openNewRequest();
      }}
      className="surface flex h-[54px] w-full items-center gap-2.5 rounded-full pl-[18px] pr-[7px] text-left text-[15px] text-muted transition-transform active:scale-[0.99]"
      data-testid="ask-bar"
    >
      <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
      <span className="flex-1">Describe el problema</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-ink text-lime" aria-hidden>
        <Mic className="size-[18px]" strokeWidth={1.9} />
      </span>
    </button>
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
  const name = (id: string) => mechanics.find((m) => m.id === id)?.name ?? 'El mecánico';
  const first = (id: string) => name(id).split(' ')[0];
  const allRequests = useApp((s) => s.db.requests);
  const actions = useApp((s) => s.db.pendingActions);
  // The cyclist's PendingActions (same as the Request Hub), then Home-only nudges.
  const attention = useMemo(() => homeAttention({ requests: allRequests, pendingActions: actions, reviews }, user?.id), [allRequests, actions, reviews, user?.id]);
  const statuses = useMemo(() => requests.map(requestStage), [requests]);
  const active = statuses.filter((c) => c === 'searching' || c === 'proposals_received' || c === 'booked').length;
  const quotes = attention.filter((a) => a.kind === 'proposal').length;
  const today = toISODate(new Date());
  const next = useMemo(() => upcomingAppointments(requests).find((r) => r.appointment!.confirmed!.date >= today), [requests, today]);
  const toSchedule = requests.find((r) => r.status === 'confirmed' && !r.appointment?.confirmed);

  const hasRequests = requests.length > 0;
  return (
    <div className="space-y-8">
      {/* 1 · The question, and a way to answer it in your own words. */}
      <section aria-labelledby="need-title" className="space-y-[18px]">
        <h2 id="need-title" className="max-w-[16ch] font-display text-[30px] font-bold leading-[1.12] tracking-[-0.025em]">
          ¿Qué le pasa a tu bici{user ? `, ${user.name.split(' ')[0]}` : ''}?
        </h2>
        <AskBar />
      </section>

      {/* 2 · Only what needs the cyclist now. */}
      {attention.length > 0 && <AttentionSection items={attention} name={name} />}

      {/* 3 · Services, as a row of photos that open the request flow. */}
      <section aria-labelledby="services-title" data-testid="widget-need">
        <h2 id="services-title" className="mb-3 font-display text-[19px] font-bold tracking-tight">
          Servicios
        </h2>
        <ServiceCarousel />
      </section>

      <WidgetGrid>
        {/* Find mechanics. */}
        <DiscoverWidget user={user} />

        {/* Their requests and the next appointment, once there are any. */}
        {hasRequests && (
          <>
            <Widget title="Solicitudes" to="/solicitudes" testId="widget-requests">
              {quotes > 0 ? (
                <Stat value={quotes} caption={quotes === 1 ? 'Presupuesto por revisar' : 'Presupuestos por revisar'} accent />
              ) : (
                <Stat value={active} caption={active === 0 ? 'Ninguna activa' : active === 1 ? 'Activa' : 'Activas'} />
              )}
            </Widget>
            <Widget title="Próxima cita" to={next ? requestHref(next) : toSchedule ? requestHref(toSchedule) : '/solicitudes'} testId="widget-appointment">
              {next ? (
                <Stat small value={shortDate(next.appointment!.confirmed!.date)} caption={`${next.appointment!.confirmed!.time} · ${serviceLabel(next)} con ${first(next.mechanicId)}`} />
              ) : toSchedule ? (
                <Stat small value="Por acordar" caption={`${serviceLabel(toSchedule)} con ${first(toSchedule.mechanicId)}`} accent />
              ) : (
                <Stat small value="—" caption="Sin citas por ahora" />
              )}
            </Widget>
          </>
        )}

        <Widget title="Mi garaje" to="/garaje" wide testId="widget-garage">
          <Feature
            icon={Bike}
            title={bikes.length === 0 ? 'Añade tu bici' : bikes.length === 1 ? bikes[0]!.name : `${bikes.length} bicicletas`}
            subtitle={bikes.length === 0 ? 'Guarda sus datos para pedir servicios más rápido' : 'Historial y reparaciones'}
          />
        </Widget>
      </WidgetGrid>
    </div>
  );
}

/**
 * Cyclist Home: discovering services first (a carousel that opens the request flow); then
 * only what needs the person, mechanics to discover, their requests and next appointment
 * (once they have any) and the garage.
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
