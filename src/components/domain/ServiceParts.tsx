import { useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarClock, CheckCheck } from 'lucide-react';
import type { AppointmentSlot, Role, ServiceRequest } from '@/domain/types';
import { AUTO_CLOSE_HOURS, DomainError, autoCloseAt, canPerform, openIncident, validateSlot, type RequestAction } from '@/domain/logic/requests';
import { formatDateTime, formatLongDate, toISODate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { Button, Card, Dialog, Field, Input, Textarea } from '@/components/ui';

const first = (n: string) => n.split(' ')[0]!;

function useAct(requestId: string) {
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: RequestAction, success: string) => {
    setBusy(action.type);
    try {
      await actOnRequest(requestId, action);
      toast(success);
      return true;
    } catch (e) {
      toast(e instanceof DomainError ? e.message : 'No se pudo completar la acción.', 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}

function SlotLine({ slot, className }: { slot: AppointmentSlot; className?: string }) {
  return (
    <p className={className}>
      <span className="first-letter:uppercase">{formatLongDate(slot.date)}</span> · {slot.time}
      {slot.note && <span className="block text-sm font-normal opacity-70">{slot.note}</span>}
    </p>
  );
}

/**
 * The appointment, agreed after hiring: either party proposes a date, the other confirms or
 * counters. A change keeps the confirmed appointment until the new one is accepted.
 */
export function AppointmentCard({ request, viewer, otherName }: { request: ServiceRequest; viewer: Role; otherName: string }) {
  const { run, busy } = useAct(request.id);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<AppointmentSlot>({ date: '', time: '', note: '' });
  const [error, setError] = useState<string>();
  const a = request.appointment;
  const pending = a?.pending;
  const editable = request.status === 'confirmed';
  const where = request.mode === 'home' ? (viewer === 'owner' ? `${first(otherName)} irá a tu domicilio.` : 'A domicilio.') : viewer === 'owner' ? `Lleva la bici al taller de ${first(otherName)}.` : 'En tu taller.';

  const propose = async () => {
    const err = validateSlot(slot);
    if (err) return setError(err);
    if (await run({ type: 'propose_appointment', slot }, `Propuesta enviada a ${first(otherName)}`)) setOpen(false);
  };
  const openForm = () => {
    setSlot({ date: pending?.date ?? a?.confirmed?.date ?? '', time: pending?.time ?? a?.confirmed?.time ?? '', note: '' });
    setError(undefined);
    setOpen(true);
  };

  return (
    <section className="space-y-3" data-testid="appointment-card">
      {a?.confirmed ? (
        <div className="rounded-3xl bg-ink p-5 text-paper sm:p-6" data-testid="appointment-confirmed">
          <p className="flex items-center gap-2 text-sm text-paper/70">
            <CalendarCheck className="size-4 text-lime" aria-hidden /> Cita confirmada
          </p>
          <SlotLine slot={a.confirmed} className="mt-2 text-2xl font-extrabold" />
          <p className="mt-1 text-paper/70">{where}</p>
          {editable && !pending && (
            <button type="button" onClick={openForm} className="mt-4 text-sm font-semibold text-lime hover:underline">
              Proponer un cambio
            </button>
          )}
        </div>
      ) : (
        !pending && (
          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 font-bold">
              <CalendarClock className="size-5" aria-hidden /> Cita por acordar
            </p>
            <p className="mt-1 text-sm text-muted">Propón una fecha; la cita queda confirmada cuando {first(otherName)} la acepte.</p>
            {editable && (
              <Button className="mt-4" onClick={openForm}>
                Proponer fecha
              </Button>
            )}
          </Card>
        )
      )}

      {pending && (
        <Card className="p-5 sm:p-6" data-testid="appointment-pending">
          {pending.by === viewer ? (
            <>
              <p className="text-sm text-muted">{a?.confirmed ? 'Has propuesto cambiar la cita a' : 'Has propuesto'}</p>
              <SlotLine slot={pending} className="mt-1 text-xl font-bold" />
              <p className="mt-2 text-sm text-muted">
                Esperando a que {first(otherName)} la confirme.{a?.confirmed ? ' Mientras tanto, sigue valiendo la cita confirmada.' : ''}
              </p>
              {editable && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={openForm}>
                  Cambiar propuesta
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{a?.confirmed ? `${first(otherName)} propone cambiar la cita a` : `${first(otherName)} propone`}</p>
              <SlotLine slot={pending} className="mt-1 text-xl font-bold" />
              {editable && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => run({ type: 'confirm_appointment' }, 'Cita confirmada')}
                    loading={busy === 'confirm_appointment'}
                    disabled={!canPerform(request, 'confirm_appointment', viewer)}
                  >
                    Confirmar cita
                  </Button>
                  <Button variant="secondary" onClick={openForm}>
                    Proponer otra fecha
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={a?.confirmed ? 'Proponer un cambio de cita' : 'Proponer fecha'}
        description={`${first(otherName)} tendrá que confirmarla.${a?.confirmed ? ' Hasta entonces sigue valiendo la cita actual.' : ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={propose} loading={busy === 'propose_appointment'}>
              Enviar propuesta
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <Input type="date" min={toISODate(new Date())} value={slot.date} onChange={(e) => (setSlot({ ...slot, date: e.target.value }), setError(undefined))} />
          </Field>
          <Field label="Hora">
            <Input type="time" value={slot.time} onChange={(e) => (setSlot({ ...slot, time: e.target.value }), setError(undefined))} />
          </Field>
        </div>
        <Field label="Nota" optional className="mt-3" error={error}>
          <Input value={slot.note ?? ''} onChange={(e) => setSlot({ ...slot, note: e.target.value })} placeholder="Ej.: portal 3, llama al llegar" maxLength={120} />
        </Field>
      </Dialog>
    </section>
  );
}

/**
 * After the mechanic marks the work finished: the cyclist confirms or reports a problem. With
 * no answer, the service closes administratively 72 h later; an open problem pauses that.
 */
export function CompletionCard({ request, viewer, otherName }: { request: ServiceRequest; viewer: Role; otherName: string }) {
  const { run, busy } = useAct(request.id);
  const [reporting, setReporting] = useState(false);
  const [text, setText] = useState('');
  if (request.status !== 'awaiting_completion') return null;
  const incident = openIncident(request);
  const closesAt = autoCloseAt(request);

  if (incident) {
    return (
      <Card className="border-2 border-ink p-5 sm:p-6" data-testid="incident-card">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle className="size-5" aria-hidden /> Problema reportado
        </p>
        <blockquote className="mt-3 rounded-2xl bg-sand p-4 text-[15px]">“{incident.text}”</blockquote>
        <p className="mt-3 text-sm text-muted">
          El cierre automático está en pausa mientras el problema siga abierto.{' '}
          {viewer === 'owner' ? `Habla con ${first(otherName)} en el chat.` : `Respóndele a ${first(otherName)} en el chat.`} En la demo, Cromiqa no media
          disputas ni gestiona reembolsos.
        </p>
        {viewer === 'owner' && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => run({ type: 'confirm_completion' }, 'Servicio completado')} loading={busy === 'confirm_completion'} icon={<CheckCheck className="size-4" aria-hidden />}>
              Está resuelto: confirmar
            </Button>
            <Button variant="secondary" onClick={() => run({ type: 'resolve_incident' }, 'Problema marcado como resuelto')} loading={busy === 'resolve_incident'}>
              Marcar problema como resuelto
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6" data-testid="completion-card">
      <p className="flex items-center gap-2 font-bold">
        <CheckCheck className="size-5" aria-hidden /> {viewer === 'owner' ? `${first(otherName)} ha terminado el trabajo` : 'Trabajo terminado'}
      </p>
      {request.completionSummary && <p className="mt-2 text-[15px]">{request.completionSummary}</p>}
      <p className="mt-3 text-sm text-muted" data-testid="auto-close-note">
        {viewer === 'owner' ? 'Si no confirmas ni reportas un problema, ' : `Si ${first(otherName)} no confirma ni reporta un problema, `}
        se cerrará automáticamente {closesAt ? `el ${formatDateTime(closesAt.toISOString())}` : `a las ${AUTO_CLOSE_HOURS} h`}. El cierre automático no implica conformidad.
      </p>
      {viewer === 'owner' && (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button size="lg" onClick={() => run({ type: 'confirm_completion' }, 'Servicio completado. ¡Gracias!')} loading={busy === 'confirm_completion'} icon={<CheckCheck className="size-4" aria-hidden />}>
              Confirmar que está terminado
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setReporting(true)}>
              Reportar un problema
            </Button>
          </div>
          <Dialog
            open={reporting}
            onClose={() => setReporting(false)}
            title="Reportar un problema"
            description={`${first(otherName)} lo verá en la conversación. El cierre automático queda en pausa hasta que lo marques como resuelto.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setReporting(false)}>
                  Volver
                </Button>
                <Button
                  variant="dark"
                  loading={busy === 'report_problem'}
                  onClick={async () => {
                    if (await run({ type: 'report_problem', text }, 'Problema reportado')) setReporting(false);
                  }}
                >
                  Reportar problema
                </Button>
              </>
            }
          >
            <Field label="Qué ha pasado">
              <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: el cambio sigue saltando en los piñones grandes." />
            </Field>
          </Dialog>
        </>
      )}
    </Card>
  );
}
