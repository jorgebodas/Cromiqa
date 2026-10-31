import { useParams } from 'react-router-dom';
import { ArrowRight, Check, FlaskConical, Repeat } from 'lucide-react';
import { bikeTypeLabel, categoryLabel, locationShort, modeLabel } from '@/domain/catalog';
import { caseHref } from '@/domain/logic/cases';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, Card, EmptyState, KeyValue, LinkButton } from '@/components/ui';

/** Confirmation after sending a request: who got an invitation and what happens next. */
export function RequestSentPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const requests = useApp((s) => s.db.requests);
  const mechanics = useApp((s) => s.db.mechanics);
  const switchAccount = useSwitchAccount();
  const caseId = requests.find((r) => r.caseId === id)?.caseId ?? requests.find((r) => r.id === id)?.caseId;
  const threads = requests.filter((r) => r.caseId === caseId && r.ownerId === user?.id);
  const request = threads[0];

  if (!request) {
    return (
      <div className="container-page py-12">
        <EmptyState as="h1" icon={<Check className="size-6" />} title="Solicitud no encontrada" action={<LinkButton to="/solicitudes" variant="dark">Ver solicitudes</LinkButton>} />
      </div>
    );
  }
  const recipients = threads.map((r) => ({ thread: r, mechanic: mechanics.find((m) => m.id === r.mechanicId) })).filter((x) => x.mechanic);
  const single = recipients.length === 1 ? recipients[0]!.mechanic!.name.split(' ')[0] : undefined;
  const demo = recipients[0];

  return (
    <div className="container-page max-w-2xl py-10 sm:py-16">
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime" aria-hidden>
          <Check className="size-8 text-ink" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl" data-testid="sent-title">
          {single ? `Solicitud enviada a ${single}` : `Solicitud enviada a ${recipients.length} mecánicos`}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Todavía no hay nada contratado. {single ? `${single} revisará` : 'Cada mecánico revisará'} tu caso y te responderá con un presupuesto, una pregunta o un “no puedo”.
        </p>
      </div>

      <Card className="mt-10 p-5 sm:p-6">
        <h2 className="font-bold">Qué pasa ahora</h2>
        <ol className="mt-4 space-y-4">
          {[
            ['Recibes respuestas', 'Presupuestos con precio y fecha, o preguntas para aclarar algo.'],
            ['Comparas y eliges', 'Aceptas uno; los demás se cierran solos. Aceptar no es un pago.'],
            ['Si nadie responde', 'Te sugeriremos invitar a más mecánicos, sin perder lo que ya tienes.'],
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
        </dl>
        <h3 className="mt-5 text-sm font-semibold text-muted">Invitaciones enviadas</h3>
        <ul className="mt-2 space-y-2" data-testid="sent-recipients">
          {recipients.map(({ thread, mechanic }) => (
            <li key={thread.id} className="flex items-center gap-3">
              <Avatar name={mechanic!.name} tone={mechanic!.avatarTone} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{mechanic!.name}</span>
              <span className="text-sm text-muted">{mechanic!.responseTime}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <LinkButton to={caseHref(request)} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
          Ver mi solicitud
        </LinkButton>
        <LinkButton to="/" size="lg" variant="secondary">
          Volver al inicio
        </LinkButton>
      </div>

      {demo && (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Modo demo:</strong> prueba el otro lado y responde como {demo.mechanic!.name.split(' ')[0]}.
            </span>
          </p>
          <Button
            variant="dark"
            size="sm"
            icon={<Repeat className="size-4" aria-hidden />}
            onClick={() => switchAccount(demo.mechanic!.userId, { to: `/pro/solicitudes/${demo.thread.id}` })}
          >
            Ver como {demo.mechanic!.name.split(' ')[0]} (mecánico)
          </Button>
        </div>
      )}
    </div>
  );
}
