import { useParams } from 'react-router-dom';
import { Check, FlaskConical, Repeat } from 'lucide-react';
import { bikeTypeLabel, locationShort, modeLabel, bikeLabel, serviceLabel } from '@/domain/catalog';
import { requestHref } from '@/domain/logic/cases';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, Card, EmptyState, KeyValue, LinkButton } from '@/components/ui';

/** Confirmation after sending a request: which mechanic got it and what happens next. */
export function RequestSentPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const requests = useApp((s) => s.db.requests);
  const mechanics = useApp((s) => s.db.mechanics);
  const switchAccount = useSwitchAccount();
  const request = requests.find((r) => r.id === id && r.ownerId === user?.id);

  if (!request) {
    return (
      <div className="container-page py-12">
        <EmptyState as="h1" icon={<Check className="size-6" />} title="Solicitud no encontrada" action={<LinkButton to="/solicitudes" variant="dark">Ver solicitudes</LinkButton>} />
      </div>
    );
  }
  const mechanic = mechanics.find((m) => m.id === request.mechanicId);
  const first = mechanic?.name.split(' ')[0] ?? 'el mecánico';

  return (
    <div className="container-page max-w-2xl py-6 sm:py-12">
      {/* A calm moment on a black layer: the lime orb breathes slowly (still with reduced motion). */}
      <section className="layer flex flex-col items-center overflow-hidden rounded-[32px] px-6 pb-6 pt-16 text-center sm:pt-20">
        <span className="cq-orb" aria-hidden />
        <h1 className="mt-14 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] sm:text-4xl" data-testid="sent-title">
          Solicitud enviada a {first}
        </h1>
        <p className="mt-2 max-w-sm text-[15px] text-layer-ink-2">Te avisamos cuando responda. Aún no hay nada contratado.</p>
        <div className="mt-10 flex w-full flex-col gap-2.5 sm:max-w-sm">
          <LinkButton to={requestHref(request)} size="lg" block>
            Ver mi solicitud
          </LinkButton>
          <LinkButton to="/" size="lg" block className="!bg-layer-well !text-layer-ink hover:!bg-white/15">
            Volver al inicio
          </LinkButton>
        </div>
      </section>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="font-bold">Resumen</h2>
        <dl className="mt-1 divide-y divide-line">
          <KeyValue label="Servicio">{serviceLabel(request)}</KeyValue>
          <KeyValue label="Bici">
            {bikeLabel(request.bike)} · {bikeTypeLabel(request.bike.type)}
          </KeyValue>
          <KeyValue label="Dónde">
            {modeLabel(request.mode)} · {locationShort(request.location)}
          </KeyValue>
        </dl>
        <h3 className="mt-5 text-sm font-semibold text-muted">Enviada a</h3>
        {mechanic && (
          <p className="mt-2 flex items-center gap-3" data-testid="sent-recipients">
            <Avatar name={mechanic.name} tone={mechanic.avatarTone} size="sm" />
            <span className="min-w-0 flex-1 truncate font-medium">{mechanic.name}</span>
            <span className="text-sm text-muted">{mechanic.responseTime}</span>
          </p>
        )}
      </Card>

      {mechanic && (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Modo demo:</strong> prueba el otro lado y responde como {first}.
            </span>
          </p>
          <Button
            variant="dark"
            size="sm"
            icon={<Repeat className="size-4" aria-hidden />}
            onClick={() => switchAccount(mechanic.userId, { to: `/pro/solicitudes/${request.id}` })}
          >
            Ver como {first} (mecánico)
          </Button>
        </div>
      )}
    </div>
  );
}
