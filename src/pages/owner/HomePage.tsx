import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bike, CalendarClock, ChevronRight, CircleCheck, Home as HomeIcon, MessageCircle, ReceiptText, Star, Store, TriangleAlert, UserX, Wrench } from 'lucide-react';
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
import { Avatar, DemoTag, cx } from '@/components/ui';


const shortDay = (d: string) => formatDate(d, { weekday: 'short', day: 'numeric' }).replace(',', '');
const shortDate = (d: string) => formatDate(d, { day: 'numeric', month: 'short' }).replace('.', '');

/**
 * One thing only the cyclist can move forward, as a square card (Insights-style): what it is
 * on top, the one fact that matters big at the bottom, and a line of detail under it.
 */
function AttentionCard({ item, mechanicName }: { item: CyclistAttention; mechanicName: string }) {
  const r = item.request;
  const proposal = currentProposal(r);
  const first = mechanicName.split(' ')[0];
  const pendingSlot = r.appointment?.pending;
  const c: { label: string; icon: typeof ReceiptText; big: string; sub: string } = {
    proposal: {
      label: 'Presupuesto pendiente',
      icon: ReceiptText,
      big: proposal ? formatPrice(proposal.price) : first!,
      sub: proposal ? `${mechanicName} · ${shortDay(proposal.date)}` : `${mechanicName} · ${serviceLabel(r)}`,
    },
    clarify: { label: 'Mensaje', icon: MessageCircle, big: first!, sub: `Necesita aclarar algo · ${serviceLabel(r)}` },
    appointment: pendingSlot
      ? { label: 'Cita por confirmar', icon: CalendarClock, big: shortDay(pendingSlot.date), sub: `${mechanicName} propone una cita · ${pendingSlot.time}` }
      : { label: 'Cita por acordar', icon: CalendarClock, big: 'Sin fecha', sub: `Acuerda la cita con ${mechanicName}` },
    confirm: {
      label: 'Trabajo terminado',
      icon: CircleCheck,
      big: item.closingSoon ? '< 24 h' : first!,
      sub: item.closingSoon ? 'Confírmalo: se cerrará en menos de 24 h' : `${serviceLabel(r)} · confirma que está bien`,
    },
    incident: { label: 'Incidencia', icon: TriangleAlert, big: 'Abierta', sub: `Con ${mechanicName} · cierre en pausa` },
    declined: { label: 'No disponible', icon: UserX, big: first!, sub: 'Pídeselo a otro mecánico' },
    review: { label: 'Valora el servicio', icon: Star, big: first!, sub: `${categoryLabel(r.category)} · completado` },
  }[item.kind];
  const lime = item.kind !== 'review' && item.kind !== 'declined';
  return (
    <li>
      <Link
        to={attentionHref(item)}
        className={cx('flex h-full min-h-[172px] flex-col justify-between rounded-[22px] p-4 transition-transform active:scale-[0.98]', lime ? 'action-fill lifted' : 'surface')}
        data-testid={`attention-${item.kind}`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-start gap-1.5 text-[14px] font-semibold leading-tight">
            <c.icon className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
            {c.label}
          </span>
          <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-full', lime ? 'bg-ink/10' : 'bg-canvas')} aria-hidden>
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </span>
        </span>
        <span className="mt-6 block">
          <span className="block truncate font-display text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{c.big}</span>
          <span className={cx('mt-1.5 line-clamp-2 block min-h-[2lh] text-[13px] leading-snug', lime ? 'text-ink/65' : 'text-muted')}>{c.sub}</span>
        </span>
      </Link>
    </li>
  );
}

/** What needs the cyclist, as square cards side by side: decisions in lime first, gentle nudges after. */
function AttentionSection({ items, name }: { items: CyclistAttention[]; name: (id: string) => string }) {
  const urgent = items.filter((i) => i.kind !== 'review' && i.kind !== 'declined').slice(0, 4);
  const later = items.filter((i) => i.kind === 'review' || i.kind === 'declined').slice(0, 2);
  // While these cards are on screen the dock shows + (they already say what's pending); once
  // they scroll away, or on any other screen, it turns back into "N pendientes".
  const ref = useRef<HTMLElement>(null);
  const setInView = useNavUi((s) => s.setPendingCardsInView);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting), { rootMargin: '0px 0px -96px 0px' });
    io.observe(el);
    return () => {
      io.disconnect();
      setInView(false);
    };
  }, [setInView]);
  return (
    <section ref={ref} aria-label="Pendiente de ti" data-testid="attention">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...urgent, ...later].map((item) => (
          <AttentionCard key={`${item.kind}-${item.request.id}`} item={item} mechanicName={name(item.request.mechanicId)} />
        ))}
      </ul>
    </section>
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
      {/* 1 · Only what needs the cyclist now. */}
      {attention.length > 0 && <AttentionSection items={attention} name={name} />}

      {/* 2 · The question, answered by picking a service: each photo opens the request flow. */}
      <section aria-labelledby="need-title" data-testid="widget-need">
        <h2 id="need-title" className="mb-3 font-display text-[19px] font-bold tracking-tight">
          ¿Qué le pasa a tu bici?
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
