import { useParams } from 'react-router-dom';
import { ArrowRight, Check, FlaskConical, Repeat } from 'lucide-react';
import { bikeTypeLabel, categoryLabel, locationShort, modeLabel } from '@/domain/catalog';
import { useMechanic, useRequest } from '@/state/selectors';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Button, Card, EmptyState, KeyValue, LinkButton } from '@/components/ui';

export function RequestSentPage() {
  const { id } = useParams();
  const request = useRequest(id);
  const mechanic = useMechanic(request?.mechanicId);
  const switchAccount = useSwitchAccount();

  if (!request || !mechanic) {
    return (
      <div className="container-page py-12">
        <EmptyState as="h1" icon={<Check className="size-6" />} title="Solicitud no encontrada" action={<LinkButton to="/solicitudes" variant="dark">Mis solicitudes</LinkButton>} />
      </div>
    );
  }
  const first = mechanic.name.split(' ')[0];

  return (
    <div className="container-page max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime" aria-hidden>
          <Check className="size-8 text-ink" strokeWidth={3} />
        </span>
        <p className="eyebrow mt-6">{request.code}</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Solicitud enviada a {first}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Todavía no es una cita confirmada. {first} revisará tu caso y te enviará una propuesta con precio y fecha.
        </p>
      </div>

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="font-bold">Qué pasa ahora</h2>
        <ol className="mt-4 space-y-4">
          {[
            [`${first} revisa tu solicitud`, `${mechanic.responseTime}.`],
            ['Recibes una propuesta', 'Precio, fecha y hora aparecerán en “Mis solicitudes”.'],
            ['Tú decides', 'Si la aceptas, la cita queda confirmada. Si no, puedes rechazarla sin coste.'],
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
          <KeyValue label="Servicio">{categoryLabel(request.category)}</KeyValue>
          <KeyValue label="Bici">
            {request.bike.brand} {request.bike.model} · {bikeTypeLabel(request.bike.type)}
          </KeyValue>
          <KeyValue label="Dónde">
            {modeLabel(request.mode)} · {locationShort(request.location)}
          </KeyValue>
          <KeyValue label="Mecánico">{mechanic.name}</KeyValue>
        </dl>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <LinkButton to={`/solicitudes/${request.id}`} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
          Ver mi solicitud
        </LinkButton>
        <LinkButton to="/" size="lg" variant="secondary">
          Volver al inicio
        </LinkButton>
      </div>

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
    </div>
  );
}
