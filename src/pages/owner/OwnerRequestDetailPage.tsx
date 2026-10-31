import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bike, Check, CircleCheckBig, FlaskConical, Repeat, Star, X } from 'lucide-react';
import { STATUSES } from '@/domain/catalog';
import { canPerform, currentProposal, DomainError, type RequestAction } from '@/domain/logic/requests';
import { formatLongDate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useMechanic, useRequest } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { StatusBadge, StatusProgress } from '@/components/domain/Status';
import { ProposalCard, RequestSummary, RequestTimeline } from '@/components/domain/RequestParts';
import { Avatar, Button, Card, Dialog, EmptyState, Field, LinkButton, Textarea, cx } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function ReviewForm({ requestId, mechanicName }: { requestId: string; mechanicName: string }) {
  const addReview = useApp((s) => s.addReview);
  const toast = useApp((s) => s.toast);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!rating) return setError('Elige una puntuación.');
    setSaving(true);
    try {
      await addReview(requestId, { rating, text });
      toast('Gracias. Tu valoración ya aparece en el perfil.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card className="p-5">
      <h2 className="font-bold">¿Qué tal con {mechanicName.split(' ')[0]}?</h2>
      <p className="mt-1 text-sm text-muted">Tu valoración se publicará en su perfil de demostración.</p>
      <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Puntuación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} de 5`}
            onClick={() => {
              setRating(n);
              setError(undefined);
            }}
            className="rounded-lg p-1.5 hover:bg-sand"
          >
            <Star className={cx('size-7', n <= rating ? 'fill-ink text-ink' : 'text-line-strong')} aria-hidden />
          </button>
        ))}
      </div>
      <Field label="Comentario" error={error} className="mt-3">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Qué te gustó, qué mejorarías…" />
      </Field>
      <Button variant="dark" className="mt-4" onClick={submit} loading={saving}>
        Publicar valoración
      </Button>
    </Card>
  );
}

function Inner() {
  const { id } = useParams();
  const user = useCurrentUser()!;
  const request = useRequest(id);
  const mechanic = useMechanic(request?.mechanicId);
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const reviews = useApp((s) => s.db.reviews);
  const bikes = useApp((s) => s.db.bikes);
  const switchAccount = useSwitchAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');

  if (!request || !mechanic || request.ownerId !== user.id) {
    return (
      <div className="container-page py-12">
        <EmptyState
          as="h1"
          icon={<X className="size-6" />}
          title="No encontramos esta solicitud"
          description="Puede que pertenezca a otra cuenta de la demo o que los datos se hayan restablecido."
          action={<LinkButton to="/actividad" variant="dark">Ver actividad</LinkButton>}
        />
      </div>
    );
  }

  const run = async (action: RequestAction, success: string) => {
    setBusy(action.type);
    try {
      await actOnRequest(request.id, action);
      toast(success);
      setDialog(null);
      setReason('');
    } catch (e) {
      toast(e instanceof DomainError ? e.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const proposal = currentProposal(request);
  const pending = request.status === 'proposal_received' && proposal?.status === 'pending';
  const garageBike = request.bikeId ? bikes.find((b) => b.id === request.bikeId) : undefined;
  const reviewed = reviews.some((r) => r.requestId === request.id);
  const first = mechanic.name.split(' ')[0];

  return (
    <>
      <ScreenHeader title="Solicitud" back="/actividad" />
      <div className="container-page pb-8 sm:pb-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{request.code}</p>
          <StatusBadge status={request.status} />
        </div>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl" data-testid="request-status-title">
          {STATUSES[request.status].label}
        </h2>
        <p className="mt-2 text-muted">{STATUSES[request.status].ownerHint}</p>
        <div className="mt-6 max-w-2xl">
          <StatusProgress status={request.status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {pending && proposal && (
            <ProposalCard proposal={proposal} highlight>
              <p className="mb-4 text-sm text-muted">Al aceptar, la cita queda confirmada con {first}. Si la rechazas, podrá enviarte otra propuesta.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" onClick={() => run({ type: 'accept_proposal' }, 'Propuesta aceptada. Cita confirmada.')} loading={busy === 'accept_proposal'} icon={<Check className="size-5" aria-hidden />}>
                  Aceptar propuesta
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setDialog('reject')}>
                  Rechazar
                </Button>
              </div>
            </ProposalCard>
          )}

          {request.status === 'confirmed' && proposal && (
            <div className="rounded-3xl bg-ink p-5 text-paper sm:p-6">
              <p className="flex items-center gap-2 text-sm text-paper/70">
                <CircleCheckBig className="size-4 text-lime" aria-hidden /> Cita confirmada
              </p>
              <p className="mt-2 text-2xl font-extrabold first-letter:uppercase">
                {formatLongDate(proposal.date)} · {proposal.time}
              </p>
              <p className="mt-1 text-paper/70">
                {request.mode === 'home' ? `${first} irá a tu domicilio.` : `Lleva la bici al taller de ${first}.`}
              </p>
            </div>
          )}

          {request.status === 'completed' && (
            <Card className="p-5 sm:p-6">
              <p className="flex items-center gap-2 font-bold">
                <CircleCheckBig className="size-5" aria-hidden /> Servicio completado
              </p>
              {request.completionSummary && <p className="mt-2 text-[15px]">{request.completionSummary}</p>}
              {garageBike ? (
                <LinkButton to={`/garaje/${garageBike.id}`} variant="secondary" size="sm" className="mt-4" icon={<Bike className="size-4" aria-hidden />}>
                  Ver historial de “{garageBike.name}”
                </LinkButton>
              ) : (
                <p className="mt-3 text-sm text-muted">Esta bici no está en tu garaje, así que el registro queda solo en esta solicitud.</p>
              )}
            </Card>
          )}

          {request.status === 'completed' && !reviewed && <ReviewForm requestId={request.id} mechanicName={mechanic.name} />}

          {proposal && !pending && request.status !== 'cancelled' && <ProposalCard proposal={proposal} />}

          <RequestSummary request={request} />
          <RequestTimeline request={request} mechanicName={mechanic.name} ownerName={user.name} viewer="owner" />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={mechanic.name} tone={mechanic.avatarTone} />
              <div className="min-w-0">
                <p className="font-bold">{mechanic.name}</p>
                <p className="truncate text-sm text-muted">{mechanic.businessName}</p>
              </div>
            </div>
            <LinkButton to={`/mecanicos/${mechanic.id}`} variant="secondary" size="sm" block className="mt-4">
              Ver perfil
            </LinkButton>
          </Card>
          {canPerform(request, 'cancel_by_owner', 'owner') && (
            <Button variant="danger" block onClick={() => setDialog('cancel')}>
              Cancelar solicitud
            </Button>
          )}
          <div className="rounded-2xl border border-dashed border-line-strong p-4">
            <p className="flex items-start gap-2 text-sm">
              <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Modo demo: mira esta solicitud desde el panel de {first}.</span>
            </p>
            <Button
              variant="dark"
              size="sm"
              block
              className="mt-3"
              icon={<Repeat className="size-4" aria-hidden />}
              onClick={() => switchAccount(mechanic.userId, { to: `/pro/solicitudes/${request.id}` })}
            >
              Ver como {first}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'reject' ? 'Rechazar propuesta' : 'Cancelar solicitud'}
        description={
          dialog === 'reject'
            ? `${first} podrá enviarte una nueva propuesta.`
            : request.status === 'confirmed'
              ? 'La cita acordada se anulará. En la demo no hay penalización.'
              : 'La solicitud dejará de estar activa.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Volver
            </Button>
            {dialog === 'reject' ? (
              <Button variant="dark" loading={busy === 'reject_proposal'} onClick={() => run({ type: 'reject_proposal', reason: reason.trim() || undefined }, 'Propuesta rechazada')}>
                Rechazar propuesta
              </Button>
            ) : (
              <Button variant="danger" loading={busy === 'cancel_by_owner'} onClick={() => run({ type: 'cancel_by_owner', reason: reason.trim() || undefined }, 'Solicitud cancelada')}>
                Cancelar solicitud
              </Button>
            )}
          </>
        }
      >
        <Field label="Motivo" optional hint={`Se lo haremos saber a ${first}.`}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dialog === 'reject' ? 'Ej.: el precio es más alto de lo esperado, ¿hay otra fecha?' : ''} />
        </Field>
      </Dialog>
      </div>
    </>
  );
}

export function OwnerRequestDetailPage() {
  return (
    <RoleGate role="owner">
      <Inner />
    </RoleGate>
  );
}
