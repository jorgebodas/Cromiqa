import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { categoryLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { searchMechanics } from '@/domain/logic/search';
import { formatDate } from '@/domain/utils';
import type { ServiceRequest } from '@/domain/types';
import { useApp } from '@/state/store';
import { ACTIVE_STATUSES, useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { useOwnerActivity } from '@/state/activity';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { OwnerQuickActions } from '@/components/layout/QuickActions';
import { StatusBadge } from '@/components/domain/Status';
import { Widget, WidgetFigure } from '@/components/widgets/Widget';
import { Avatar, Rating, cx } from '@/components/ui';
import { CATEGORY_ICONS, NEED_OPTIONS, useStartRequest } from './startRequest';

/** "Sábado, 31 oct", like the date under a Fitness summary. */
function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The four needs as big tap targets: the main thing anyone can do from here. */
function NeedWidget() {
  const start = useStartRequest();
  return (
    <Widget title="¿Qué necesita tu bici?" caption="Elige y te mostramos quién puede ayudarte" size="full" testId="widget-need">
      <ul className="grid grid-cols-2 gap-2">
        {NEED_OPTIONS.map((o) => {
          const Icon = CATEGORY_ICONS[o.id];
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => start(o.id)}
                className="flex h-full min-h-16 w-full items-center gap-2.5 rounded-2xl bg-paper px-3 py-3 text-left text-[15px] font-semibold leading-tight transition-colors hover:bg-paper/70 active:scale-[0.98]"
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Widget>
  );
}

function MechanicsWidget() {
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const top = useMemo(() => searchMechanics(mechanics, reviews, { sort: 'rating' }).slice(0, 3), [mechanics, reviews]);
  return (
    <Widget title="Mecánicos" caption="Los mejor valorados" to="/mecanicos" size="full" testId="widget-mechanics">
      <ul className="space-y-2.5">
        {top.map(({ mechanic: m, rating, reviewCount }) => (
          <li key={m.id} className="flex items-center gap-3">
            <Avatar name={m.name} tone={m.avatarTone} size="sm" className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{m.name}</span>
              <span className="block truncate text-sm text-muted">{m.headline}</span>
            </span>
            <Rating rating={rating} count={reviewCount} compact />
          </li>
        ))}
      </ul>
    </Widget>
  );
}

function MechanicDemoWidget() {
  const switchAccount = useSwitchAccount();
  return (
    <Widget title="Soy mecánico" caption="Prueba el panel" tone="ink" onClick={() => switchAccount('u-carlos', { to: '/pro' })} testId="widget-pro">
      <p className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-lime">
        Demo <ArrowRight className="size-4" aria-hidden />
      </p>
    </Widget>
  );
}

/** The request that needs the owner most: a proposal to answer first, then the latest active one. */
function RequestWidget({ request, total }: { request: ServiceRequest; total: number }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const mechanic = mechanics.find((m) => m.id === request.mechanicId);
  const decide = request.status === 'proposal_received';
  const proposal = currentProposal(request);
  return (
    <Widget
      title={decide ? 'Tienes una propuesta' : 'Tu solicitud'}
      caption={total > 1 ? `${total} en curso` : 'En curso'}
      to={`/solicitudes/${request.id}`}
      size="full"
      tone={decide ? 'ink' : 'sand'}
      testId="widget-request"
    >
      <p className="text-[17px] font-semibold">
        {categoryLabel(request.category)}
        {mechanic && <span className={cx('font-normal', decide ? 'text-paper/70' : 'text-muted')}> · {mechanic.name}</span>}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
        <StatusBadge status={request.status} />
        {decide && proposal && (
          <span className="font-display text-2xl font-extrabold text-lime">
            {proposal.price} €
          </span>
        )}
      </div>
    </Widget>
  );
}

function OwnerWidgets({ ownerId }: { ownerId: string }) {
  const requests = useRequestsFor({ ownerId });
  const bikes = useOwnerBikes(ownerId);
  const maintenance = useApp((s) => s.db.maintenance);
  const mechanics = useApp((s) => s.db.mechanics);
  const { unread } = useOwnerActivity(ownerId);

  const active = requests
    .filter((r) => ACTIVE_STATUSES.includes(r.status))
    .sort((a, b) => Number(b.status === 'proposal_received') - Number(a.status === 'proposal_received'));
  const appointment = requests
    .filter((r) => r.status === 'confirmed' || r.status === 'in_progress')
    .map((r) => ({ r, p: currentProposal(r) }))
    .filter((x) => x.p)
    .sort((a, b) => (a.p!.date + a.p!.time).localeCompare(b.p!.date + b.p!.time))[0];
  const lastService = maintenance
    .filter((m) => bikes.some((b) => b.id === m.bikeId))
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <>
      {active[0] && <RequestWidget request={active[0]} total={active.length} />}

      <Widget title="Novedades" caption={unread ? 'Para ti' : 'Todo al día'} to="/actividad?ver=novedades" testId="widget-updates">
        <WidgetFigure value={unread} unit="sin leer" accent={unread > 0} />
      </Widget>

      {appointment ? (
        <Widget
          title="Próxima cita"
          caption={mechanics.find((m) => m.id === appointment.r.mechanicId)?.name}
          to={`/solicitudes/${appointment.r.id}`}
          testId="widget-appointment"
        >
          <WidgetFigure value={formatDate(appointment.p!.date)} unit={appointment.p!.time} />
        </Widget>
      ) : (
        <Widget title="Solicitudes" caption="En curso" to="/actividad" testId="widget-requests">
          <WidgetFigure value={active.length} unit={active.length === 1 ? 'activa' : 'activas'} />
        </Widget>
      )}

      <NeedWidget />

      <Widget title="Garaje" caption={lastService ? `Último: ${formatDate(lastService.date)}` : 'Tus bicis'} to="/garaje" testId="widget-garage">
        <WidgetFigure value={bikes.length} unit={bikes.length === 1 ? 'bici' : 'bicis'} />
      </Widget>

      {appointment ? (
        <Widget title="Solicitudes" caption="En curso" to="/actividad" testId="widget-requests">
          <WidgetFigure value={active.length} unit={active.length === 1 ? 'activa' : 'activas'} />
        </Widget>
      ) : (
        <MechanicDemoWidget />
      )}

      <MechanicsWidget />
      {appointment && <MechanicDemoWidget />}
    </>
  );
}

/**
 * Home as the cyclist's control centre: widgets for what's pending (requests, proposals,
 * appointments, updates), what they can do (ask for a service), and useful information
 * (garage, mechanics). Every widget is a card that opens the matching screen.
 */
export function HomePage() {
  const user = useCurrentUser();
  const isOwner = user?.role === 'owner';
  return (
    <>
      <ScreenHeader title="Inicio" description={todayLabel()} actions={<OwnerQuickActions />} />
      <div className="container-page pb-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isOwner ? (
            <OwnerWidgets ownerId={user.id} />
          ) : (
            <>
              <NeedWidget />
              <Widget title="Demo" caption="Entra como ciclista" to="/demo" testId="widget-demo">
                <p className="mt-auto text-sm text-muted">Datos ficticios</p>
              </Widget>
              <MechanicDemoWidget />
              <MechanicsWidget />
            </>
          )}
        </div>
      </div>
    </>
  );
}
