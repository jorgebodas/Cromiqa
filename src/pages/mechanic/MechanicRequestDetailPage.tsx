import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCheck, FlaskConical, Hammer, MessageCircleQuestion, Repeat, Send, X } from 'lucide-react';
import type { ProposalInput, ServiceRequest, Mechanic, TimeSlot } from '@/domain/types';
import { STATUSES, locationLabel } from '@/domain/catalog';
import { DomainError, canPerform, currentProposal, validateProposal, type RequestAction } from '@/domain/logic/requests';
import { formatLongDate, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequest, useUserName } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { StatusBadge, StatusProgress } from '@/components/domain/Status';
import { OpenProposalCard, ProposalCard, RequestSummary, RequestTimeline } from '@/components/domain/RequestParts';
import { Avatar, Button, Card, Dialog, EmptyState, Field, Input, LinkButton, Textarea } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { isBooked } from './MechanicRequestsPage';
import { threadHref } from '@/domain/logic/cases';

const SLOT_TIME: Record<TimeSlot, string> = { morning: '10:00', afternoon: '17:00', evening: '19:30' };

function defaultProposal(r: ServiceRequest, m: Mechanic, ownerFirst: string): ProposalInput {
  const services = m.services.filter((s) => s.category === r.category && s.priceFrom !== undefined);
  const base = services.length ? Math.min(...services.map((s) => s.priceFrom!)) : 30;
  const fee = r.mode === 'home' ? m.homeServiceFee ?? 0 : 0;
  const today = toISODate(new Date());
  const candidates = [r.availability.preferredDate, m.nextAvailableDate].filter((d): d is string => !!d && d >= today);
  return {
    price: Math.max(base + fee, 10),
    date: candidates[0] ?? today,
    time: SLOT_TIME[r.availability.timeSlots[0] ?? 'afternoon'],
    durationMinutes: services[0]?.durationMinutes,
    message: `Hola ${ownerFirst}, he revisado tu solicitud. `,
  };
}

function ProposalForm({ request, mechanic, ownerFirst, onDone, onCancel }: { request: ServiceRequest; mechanic: Mechanic; ownerFirst: string; onDone: () => void; onCancel?: () => void }) {
  const revising = request.status === 'proposal_received';
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [form, setForm] = useState<ProposalInput>(() => {
    const current = currentProposal(request);
    return revising && current ? { price: current.price, date: current.date, time: current.time, durationMinutes: current.durationMinutes, message: current.message } : defaultProposal(request, mechanic, ownerFirst);
  });
  const [priceText, setPriceText] = useState(String(form.price));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ProposalInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const input = { ...form, price: Number(priceText.replace(',', '.')) };
    const e = validateProposal(input);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await actOnRequest(request.id, { type: revising ? 'revise_proposal' : 'send_proposal', proposal: input });
      toast(revising ? `Presupuesto revisado. ${ownerFirst} tiene que aprobarlo.` : `Presupuesto enviado a ${ownerFirst}`);
      onDone();
    } catch (err) {
      toast(err instanceof DomainError ? err.message : 'No se pudo enviar la propuesta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-ink p-5 sm:p-6" aria-labelledby="proposal-form-title" data-testid="proposal-form">
      <h2 id="proposal-form-title" className="text-lg font-bold">
        {revising ? `Revisar presupuesto · versión ${request.proposals.length + 1}` : 'Presupuesto cerrado'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {revising
          ? `Sustituye a la versión actual. ${ownerFirst} tendrá que aprobar la nueva versión; nada cambia sin su aceptación.`
          : `Precio, fecha y alcance. ${ownerFirst} podrá aceptarlo o rechazarlo; el chat se abre si lo acepta.`}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Precio total (€)" error={errors.price} hint={request.mode === 'home' && mechanic.homeServiceFee ? `Incluye desplazamiento (${mechanic.homeServiceFee} €).` : undefined}>
          <Input name="price" type="number" inputMode="decimal" min={1} step="1" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
        </Field>
        <Field label="Duración estimada (min)" optional>
          <Input
            name="duration"
            type="number"
            inputMode="numeric"
            min={5}
            value={form.durationMinutes ?? ''}
            onChange={(e) => set({ durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="Fecha" error={errors.date}>
          <Input name="date" type="date" min={toISODate(new Date())} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Hora" error={errors.time}>
          <Input name="time" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
      </div>
      <Field label="Mensaje para el cliente" error={errors.message} className="mt-4" hint="Explica qué incluye el precio y qué necesitas de su parte.">
        <Textarea name="message" rows={4} value={form.message} onChange={(e) => set({ message: e.target.value })} maxLength={600} />
      </Field>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button size="lg" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button size="lg" onClick={submit} loading={saving} icon={<Send className="size-4" aria-hidden />}>
          {revising ? 'Enviar revisión' : 'Enviar presupuesto'}
        </Button>
      </div>
    </section>
  );
}

function OpenProposalForm({ request, ownerFirst, onDone }: { request: ServiceRequest; ownerFirst: string; onDone: () => void }) {
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await actOnRequest(request.id, { type: 'send_open_proposal', message });
      toast(`Propuesta abierta enviada. Ya podéis hablar por chat.`);
      onDone();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : 'No se pudo enviar.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="rounded-3xl border border-ink p-5 sm:p-6" data-testid="open-proposal-form">
      <h2 className="text-lg font-bold">Propuesta abierta</h2>
      <p className="mt-1 text-sm text-muted">
        Para cuando necesitas aclarar algo antes de dar un precio. Abre el chat con {ownerFirst}; no es un presupuesto ni le compromete a nada.
      </p>
      <Field label="Qué necesitas saber" error={error} className="mt-4">
        <Textarea rows={4} value={message} onChange={(e) => (setMessage(e.target.value), setError(undefined))} maxLength={600} placeholder="Ej.: ¿me mandas una foto del cambio? Según lo que vea, puede ser solo ajuste o hará falta patilla nueva." />
      </Field>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button size="lg" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button size="lg" onClick={submit} loading={saving} icon={<MessageCircleQuestion className="size-4" aria-hidden />}>
          Enviar propuesta abierta
        </Button>
      </div>
    </section>
  );
}

function Inner() {
  const { id } = useParams();
  const mechanic = useCurrentMechanic()!;
  const request = useRequest(id);
  const ownerName = useUserName(request?.ownerId);
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const ownerUser = useApp((s) => s.db.users.find((u) => u.id === request?.ownerId));
  const switchAccount = useSwitchAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'reject' | 'complete' | null>(null);
  const [text, setText] = useState('');
  const [composing, setComposing] = useState<'quote' | 'open' | null>(null);

  if (!request || request.mechanicId !== mechanic.id) {
    return (
      <div className="container-page py-12">
        <EmptyState
          as="h1"
          icon={<X className="size-6" />}
          title="No encontramos esta solicitud"
          description="Puede que esté asignada a otro mecánico de la demo."
          action={<LinkButton to="/pro/solicitudes" variant="dark">Ver solicitudes</LinkButton>}
        />
      </div>
    );
  }

  const ownerFirst = ownerName.split(' ')[0]!;
  const proposal = currentProposal(request);
  const lastRejected = request.status === 'cancelled' && proposal?.status === 'rejected' ? proposal : undefined;
  const rejectionReason = lastRejected ? [...request.events].reverse().find((e) => e.type === 'proposal_rejected')?.text : undefined;
  const answering = request.status === 'sent' || request.status === 'awaiting_proposal';
  const can = (a: RequestAction['type']) => canPerform(request, a, 'mechanic');

  const run = async (action: RequestAction, success: string) => {
    setBusy(action.type);
    try {
      await actOnRequest(request.id, action);
      toast(success);
      setDialog(null);
      setText('');
    } catch (e) {
      toast(e instanceof DomainError ? e.message : 'No se pudo completar la acción.', 'error');
    } finally {
      setBusy(null);
    }
  };


  return (
    <>
      <ScreenHeader title={isBooked(request) ? 'Servicio' : 'Solicitud'} back={isBooked(request) ? '/pro/trabajos' : '/pro/solicitudes'} />
      <div className="container-page pb-8 sm:pb-10">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{request.code}</p>
          <StatusBadge status={request.status} />
        </div>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl" data-testid="request-status-title">
          {request.status === 'sent'
            ? `Nueva solicitud de ${ownerFirst}`
            : request.status === 'proposal_received'
              ? 'Presupuesto enviado'
              : request.status === 'awaiting_proposal' && request.openProposal
                ? 'Propuesta abierta'
                : STATUSES[request.status].label}
        </h2>
        <p className="mt-2 text-muted">{STATUSES[request.status].mechanicHint}</p>
        <div className="mt-6 max-w-2xl">
          <StatusProgress status={request.status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {request.status !== 'not_selected' && <OpenProposalCard request={request} mechanicName={mechanic.name} viewer="mechanic" />}

          {answering && !composing && (
            <Card className="p-5 sm:p-6" data-testid="respond-options">
              <h2 className="text-lg font-bold">{request.openProposal ? `¿Ya puedes darle precio a ${ownerFirst}?` : `Responde a ${ownerFirst}`}</h2>
              <p className="mt-1 text-sm text-muted">
                {request.openProposal
                  ? 'Cuando lo tengas claro, envía un presupuesto cerrado con precio y fecha.'
                  : 'Envía un presupuesto cerrado si lo tienes claro, o una propuesta abierta si necesitas aclarar algo antes.'}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button size="lg" onClick={() => setComposing('quote')} icon={<Send className="size-4" aria-hidden />}>
                  Presupuesto cerrado
                </Button>
                {!request.openProposal && (
                  <Button size="lg" variant="secondary" onClick={() => setComposing('open')} icon={<MessageCircleQuestion className="size-4" aria-hidden />}>
                    Propuesta abierta
                  </Button>
                )}
                <Button size="lg" variant="ghost" onClick={() => setDialog('reject')}>
                  No puedo atenderla
                </Button>
              </div>
            </Card>
          )}

          {composing === 'open' && <OpenProposalForm request={request} ownerFirst={ownerFirst} onDone={() => setComposing(null)} />}
          {composing === 'quote' && <ProposalForm request={request} mechanic={mechanic} ownerFirst={ownerFirst} onDone={() => setComposing(null)} onCancel={() => setComposing(null)} />}

          {lastRejected && (
            <div className="rounded-2xl bg-sand p-4 text-sm" data-testid="quote-rejected">
              <strong className="font-semibold">{ownerFirst} rechazó tu presupuesto</strong>
              {rejectionReason ? `: “${rejectionReason}”` : '.'} Esta invitación queda cerrada.
            </div>
          )}

          {request.status === 'not_selected' && (
            <div className="rounded-2xl bg-sand p-4 text-sm" data-testid="not-selected">
              <strong className="font-semibold">{ownerFirst} eligió a otro mecánico.</strong> Esta invitación queda cerrada; gracias por responder.
            </div>
          )}

          {request.status === 'proposal_received' && proposal && composing !== 'quote' && (
            <ProposalCard proposal={proposal} version={request.proposals.length} viewer="mechanic">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">Esperando la respuesta de {ownerFirst}.</p>
                <Button variant="secondary" size="sm" onClick={() => setComposing('quote')}>
                  Revisar presupuesto
                </Button>
              </div>
            </ProposalCard>
          )}

          {request.status === 'confirmed' && proposal && (
            <section className="rounded-3xl bg-ink p-5 text-paper sm:p-6">
              <p className="text-sm text-paper/70">Cita acordada</p>
              <p className="mt-1 text-2xl font-extrabold first-letter:uppercase">
                {formatLongDate(proposal.date)} · {proposal.time}
              </p>
              <p className="mt-1 text-paper/70">
                {request.mode === 'home' ? `A domicilio en ${locationLabel(request.location)}` : 'En tu taller'} · {proposal.price} €
              </p>
              <button
                type="button"
                onClick={() => run({ type: 'start' }, 'Trabajo marcado en curso')}
                disabled={busy === 'start'}
                className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 font-semibold text-ink hover:bg-lime-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-60"
              >
                <Hammer className="size-4" aria-hidden /> Marcar en curso
              </button>
            </section>
          )}

          {request.status === 'in_progress' && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">Trabajo en curso</h2>
              <p className="mt-1 text-sm text-muted">Al completarlo, se añadirá un registro al historial de la bici de {ownerFirst}.</p>
              <Button size="lg" className="mt-5" onClick={() => setDialog('complete')} icon={<CheckCheck className="size-4" aria-hidden />}>
                Marcar como completado
              </Button>
            </Card>
          )}

          {request.status === 'completed' && (
            <Card className="p-5 sm:p-6">
              <p className="flex items-center gap-2 font-bold">
                <CheckCheck className="size-5" aria-hidden /> Trabajo completado
              </p>
              {request.completionSummary && <p className="mt-2 text-[15px]">{request.completionSummary}</p>}
            </Card>
          )}

          {proposal && ['confirmed', 'in_progress', 'completed'].includes(request.status) && <ProposalCard proposal={proposal} />}

          <RequestSummary request={request} />
          <RequestTimeline request={request} mechanicName={mechanic.name} ownerName={ownerName} viewer="mechanic" />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="eyebrow mb-3">Cliente</p>
            <div className="flex items-center gap-3">
              <Avatar name={ownerName} />
              <div>
                <p className="font-bold">{ownerName}</p>
                <p className="text-sm text-muted">{ownerUser ? locationLabel(ownerUser.location) : ''}</p>
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
              Los datos de contacto se compartirían al confirmar la cita. En la demo no hay datos de contacto reales.
            </p>
          </Card>
          {can('reject_request') && !answering && (
            <Button variant="danger" block onClick={() => setDialog('reject')}>
              No puedo atenderla
            </Button>
          )}
          <div className="rounded-2xl border border-dashed border-line-strong p-4">
            <p className="flex items-start gap-2 text-sm">
              <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Modo demo: mira cómo lo ve {ownerFirst}.</span>
            </p>
            <Button
              variant="dark"
              size="sm"
              block
              className="mt-3"
              icon={<Repeat className="size-4" aria-hidden />}
              onClick={() => switchAccount(request.ownerId, { to: threadHref(request) })}
            >
              Ver como {ownerFirst}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'reject' ? 'Rechazar solicitud' : 'Completar trabajo'}
        description={dialog === 'reject' ? `${ownerFirst} verá que no puedes atenderla. Solo se cierra tu invitación; su solicitud sigue abierta para otros mecánicos.` : 'Resume lo que has hecho. Aparecerá en el historial de la bici.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Volver
            </Button>
            {dialog === 'reject' ? (
              <Button variant="danger" loading={busy === 'reject_request'} onClick={() => run({ type: 'reject_request', reason: text.trim() || undefined }, 'Solicitud rechazada')}>
                Rechazar solicitud
              </Button>
            ) : (
              <Button loading={busy === 'complete'} onClick={() => run({ type: 'complete', summary: text }, 'Trabajo completado. Registro añadido al garaje del cliente.')}>
                Marcar como completado
              </Button>
            )}
          </>
        }
      >
        <Field label={dialog === 'reject' ? 'Motivo' : 'Resumen del trabajo'} optional={dialog === 'reject'}>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dialog === 'reject' ? 'Ej.: no tengo hueco esas fechas.' : 'Ej.: ajuste de desviador trasero, cable y funda nuevos, patilla enderezada.'}
          />
        </Field>
      </Dialog>
      </div>
    </>
  );
}

export function MechanicRequestDetailPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
