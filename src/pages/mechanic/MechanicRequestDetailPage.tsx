import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, FlaskConical, Hammer, Repeat, Send, ThumbsUp, X } from 'lucide-react';
import type { ProposalInput, ServiceRequest, Mechanic, TimeSlot } from '@/domain/types';
import { STATUSES, locationLabel } from '@/domain/catalog';
import { DomainError, canPerform, currentProposal, validateProposal, type RequestAction } from '@/domain/logic/requests';
import { formatLongDate, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentMechanic, useRequest, useUserName } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { StatusBadge, StatusProgress } from '@/components/domain/Status';
import { ProposalCard, RequestSummary, RequestTimeline } from '@/components/domain/RequestParts';
import { Avatar, Button, Card, Dialog, EmptyState, Field, Input, LinkButton, Textarea } from '@/components/ui';

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

function ProposalForm({ request, mechanic, ownerFirst, onDone }: { request: ServiceRequest; mechanic: Mechanic; ownerFirst: string; onDone: () => void }) {
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [form, setForm] = useState<ProposalInput>(() => defaultProposal(request, mechanic, ownerFirst));
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
      await actOnRequest(request.id, { type: 'send_proposal', proposal: input });
      toast(`Propuesta enviada a ${ownerFirst}`);
      onDone();
    } catch (err) {
      toast(err instanceof DomainError ? err.message : 'No se pudo enviar la propuesta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-ink p-5 sm:p-6" aria-labelledby="proposal-form-title" data-testid="proposal-form">
      <h2 id="proposal-form-title" className="text-lg font-bold">Enviar propuesta</h2>
      <p className="mt-1 text-sm text-muted">{ownerFirst} verá el precio, la fecha y tu mensaje, y podrá aceptarla o rechazarla.</p>
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
      <div className="mt-5 flex justify-end">
        <Button size="lg" onClick={submit} loading={saving} icon={<Send className="size-4" aria-hidden />}>
          Enviar propuesta
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
  const [reproposing, setReproposing] = useState(false);

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
  const lastRejected = request.status === 'awaiting_proposal' && proposal?.status === 'rejected' ? proposal : undefined;
  const rejectionReason = lastRejected ? [...request.events].reverse().find((e) => e.type === 'proposal_rejected')?.text : undefined;
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

  const showForm = request.status === 'awaiting_proposal' || reproposing;

  return (
    <div className="container-page py-6 sm:py-10">
      <Link to="/pro/solicitudes" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Solicitudes
      </Link>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{request.code}</p>
          <StatusBadge status={request.status} />
        </div>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl" data-testid="request-status-title">
          {request.status === 'sent' ? `Nueva solicitud de ${ownerFirst}` : request.status === 'proposal_received' ? 'Propuesta enviada' : STATUSES[request.status].label}
        </h1>
        <p className="mt-2 text-muted">{STATUSES[request.status].mechanicHint}</p>
        <div className="mt-6 max-w-2xl">
          <StatusProgress status={request.status} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {request.status === 'sent' && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold">¿Puedes encargarte?</h2>
              <p className="mt-1 text-sm text-muted">
                Acepta para valorarla y prepara tu propuesta, o envía directamente precio y cita si lo tienes claro.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button size="lg" loading={busy === 'accept_for_review'} onClick={() => run({ type: 'accept_for_review' }, 'Solicitud aceptada para valorar')} icon={<ThumbsUp className="size-4" aria-hidden />}>
                  Aceptar para valorar
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setReproposing(true)}>
                  Proponer precio ya
                </Button>
              </div>
            </Card>
          )}

          {lastRejected && (
            <div className="rounded-2xl bg-sand p-4 text-sm">
              <strong className="font-semibold">{ownerFirst} rechazó tu propuesta anterior</strong>
              {rejectionReason ? `: “${rejectionReason}”` : '.'} Puedes enviar una nueva.
            </div>
          )}

          {showForm && <ProposalForm request={request} mechanic={mechanic} ownerFirst={ownerFirst} onDone={() => setReproposing(false)} />}

          {request.status === 'proposal_received' && proposal && !reproposing && (
            <ProposalCard proposal={proposal}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">Esperando la respuesta de {ownerFirst}.</p>
                <Button variant="secondary" size="sm" onClick={() => setReproposing(true)}>
                  Enviar otra propuesta
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
          {can('reject_request') && (
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
              onClick={() => switchAccount(request.ownerId, { to: `/solicitudes/${request.id}` })}
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
        description={dialog === 'reject' ? `${ownerFirst} verá que no puedes atenderla y podrá pedírselo a otro mecánico.` : 'Resume lo que has hecho. Aparecerá en el historial de la bici.'}
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
  );
}

export function MechanicRequestDetailPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
