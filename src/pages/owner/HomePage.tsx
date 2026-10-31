import { useMemo, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Home as HomeIcon, Store } from 'lucide-react';
import type { BikeType, LocationId, ServiceRequest, User } from '@/domain/types';
import { bikeTypeLabel, categoryLabel, locationShort, specializationLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { searchMechanics, type MechanicResult } from '@/domain/logic/search';
import { cyclistAttention, cyclistInProgress, type CyclistAttention } from '@/domain/logic/home';
import { formatDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions, ProfileButton } from '@/components/layout/QuickActions';
import { StatusBadge } from '@/components/domain/Status';
import { Avatar, DemoTag, cx } from '@/components/ui';
import { CATEGORY_ICONS, NEED_OPTIONS, useStartRequest } from './startRequest';

/** "Sábado, 31 oct", locale-aware. */
function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Section({ title, action, children, testId }: { title: string; action?: ReactNode; children: ReactNode; testId?: string }) {
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

const SeeAll = ({ to, children = 'Ver todas' }: { to: string; children?: ReactNode }) => (
  <Link to={to} className="text-sm font-semibold hover:underline">
    {children}
  </Link>
);

/** 1 · Primary intent: start a request. Compact, since the + is always there too. */
function NeedSection({ intro }: { intro?: boolean }) {
  const start = useStartRequest();
  return (
    <section className="surface p-4 sm:p-5" aria-labelledby="need-title" data-testid="widget-need">
      {intro && <p className="mb-1 text-sm text-muted">Te ayudamos a encontrar al mecánico adecuado.</p>}
      <h2 id="need-title" className="font-display text-[22px] font-bold tracking-tight">
        ¿Qué necesita tu bici?
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {NEED_OPTIONS.map((o) => {
          const Icon = CATEGORY_ICONS[o.id];
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => start(o.id)}
                className="flex h-full min-h-14 w-full items-center gap-2.5 rounded-2xl bg-canvas px-3 py-2.5 text-left text-[15px] font-semibold leading-tight transition-colors hover:bg-sand-deep active:scale-[0.98]"
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 2 · Requires your attention: one card per item, with the action that moves it forward. */
function AttentionCard({ item, mechanicName }: { item: CyclistAttention; mechanicName: string }) {
  const r = item.request;
  const proposal = currentProposal(r);
  const content = {
    proposal: {
      title: `Propuesta de ${mechanicName}`,
      detail: proposal ? `${categoryLabel(r.category)} · ${formatPrice(proposal.price)} · ${formatDate(proposal.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${proposal.time}` : categoryLabel(r.category),
      cta: 'Revisar propuesta',
      to: `/solicitudes/${r.id}`,
    },
    declined: {
      title: `${mechanicName} no puede atenderte`,
      detail: `${categoryLabel(r.category)} · Busca otro profesional para esta solicitud`,
      cta: 'Buscar otro mecánico',
      to: `/mecanicos?servicio=${r.category}`,
    },
    review: {
      title: `¿Qué tal con ${mechanicName}?`,
      detail: `${categoryLabel(r.category)} · Servicio completado`,
      cta: 'Valorar el servicio',
      to: `/solicitudes/${r.id}`,
    },
  }[item.kind];
  const dark = item.kind === 'proposal';
  return (
    <Link
      to={content.to}
      className={cx('surface flex items-center gap-3 p-4', dark && '!bg-ink text-paper')}
      data-testid={`attention-${item.kind}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{content.title}</span>
        <span className={cx('mt-0.5 block text-sm', dark ? 'text-paper/70' : 'text-muted')}>{content.detail}</span>
        <span className={cx('mt-2 inline-flex items-center gap-1 text-sm font-semibold', dark ? 'text-lime' : 'text-ink')}>
          {content.cta} <ArrowRight className="size-4" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** 3 · In progress: a short summary; the full list lives in Solicitudes. */
function InProgressRow({ request: r, mechanicName }: { request: ServiceRequest; mechanicName: string }) {
  const p = currentProposal(r);
  const booked = r.status === 'confirmed' || r.status === 'in_progress';
  return (
    <li>
      <Link to={`/solicitudes/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {categoryLabel(r.category)} <span className="font-normal text-muted">· {mechanicName}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status={r.status} />
            {booked && p && <span>{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {p.time}</span>}
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

/** 4 · Discover: a few relevant professionals, with grounded reasons and no invented ratings. */
function DiscoverSection({ user }: { user: User | null }) {
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
    <Section title={user ? 'Mecánicos para ti' : 'Mecánicos'} action={<SeeAll to="/mecanicos">Ver todos</SeeAll>} testId="discover">
      <ul className="surface divide-y divide-line overflow-hidden">
        {picks.map((r) => {
          const m = r.mechanic;
          const reasons = reasonsFor(r, location, bikeType);
          return (
            <li key={m.id}>
              <Link to={`/mecanicos/${m.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60">
                <Avatar name={m.name} tone={m.avatarTone} size="sm" className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{m.name}</span>
                    <DemoTag />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{reasons.join(' · ') || m.headline}</span>
                  <span className="mt-1 flex items-center gap-3 text-xs text-muted">
                    {m.workshop && (
                      <span className="inline-flex items-center gap-1">
                        <Store className="size-3.5" aria-hidden /> Taller
                      </span>
                    )}
                    {m.homeService && (
                      <span className="inline-flex items-center gap-1">
                        <HomeIcon className="size-3.5" aria-hidden /> A domicilio
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function CyclistHome({ user }: { user: User | null }) {
  const requests = useRequestsFor({ ownerId: user?.id ?? '__guest__' });
  const reviews = useApp((s) => s.db.reviews);
  const mechanics = useApp((s) => s.db.mechanics);
  const name = (id: string) => mechanics.find((m) => m.id === id)?.name ?? 'El mecánico';
  const attention = useMemo(() => cyclistAttention(requests, reviews), [requests, reviews]);
  const inProgress = useMemo(() => cyclistInProgress(requests), [requests]);
  const firstTime = requests.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="space-y-6">
        <NeedSection intro={firstTime} />
        {attention.length > 0 && (
          <Section title="Requiere tu atención" testId="attention">
            <ul className="space-y-3">
              {attention.map((item) => (
                <li key={`${item.kind}-${item.request.id}`}>
                  <AttentionCard item={item} mechanicName={name(item.request.mechanicId)} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        {inProgress.length > 0 && (
          <Section title="En curso" action={<SeeAll to="/solicitudes" />} testId="in-progress">
            <ul className="surface divide-y divide-line overflow-hidden">
              {inProgress.slice(0, 3).map((r) => (
                <InProgressRow key={r.id} request={r} mechanicName={name(r.mechanicId)} />
              ))}
            </ul>
          </Section>
        )}
      </div>
      <DiscoverSection user={user} />
    </div>
  );
}

/**
 * Cyclist Home, state-driven: start a request first; then only what needs the person (a
 * proposal to review, a mechanic who could not take it, a service to rate), a short summary
 * of what's in progress, and a few relevant mechanics. New accounts and guests see the
 * request entry and discovery only.
 */
export function HomePage() {
  const user = useCurrentUser();
  const mode = useMode();
  // Mechanic mode has its own Home.
  if (user && mode === 'mechanic') return <Navigate to="/pro" replace />;
  return (
    <>
      <ScreenHeader title="Inicio" description={todayLabel()} leading={<ProfileButton />} actions={<CyclistHeaderActions />} />
      <div className="container-page pb-8">
        <CyclistHome user={user} />
      </div>
    </>
  );
}
