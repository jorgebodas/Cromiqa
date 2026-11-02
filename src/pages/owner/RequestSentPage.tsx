import { useParams } from 'react-router-dom';
import { ArrowRight, Check, FlaskConical, Repeat } from 'lucide-react';
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
    <div className="container-page max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime" aria-hidden>
          <Check className="size-8 text-ink" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl" data-testid="sent-title">
          Solicitud enviada a {first}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Todavía no hay nada contratado. {first} revisará tu caso y te responderá con un presupuesto, una pregunta o un “no puedo”.
        </p>
      </div>

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="font-bold">Qué pasa ahora</h2>
        <ol className="mt-4 space-y-4">
          {[
            ['Recibes su respuesta', 'Un presupuesto con precio y fecha, o una pregunta para aclarar algo.'],
            ['Decides', 'Aceptas o rechazas el presupuesto. Aceptar no es un pago.'],
            ['¿Quieres otra opinión?', 'Crea otra solicitud para consultar a otro mecánico.'],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand font-display text-sm font-bold">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

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

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <LinkButton to={requestHref(request)} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
          Ver mi solicitud
        </LinkButton>
        <LinkButton to="/" size="lg" variant="secondary">
          Volver al inicio
        </LinkButton>
      </div>

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
