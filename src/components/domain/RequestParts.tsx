import { useState, type FormEvent, type ReactNode } from 'react';
import { CalendarDays, Clock, MessageSquare, Send } from 'lucide-react';
import type { Proposal, RequestEvent, Role, ServiceRequest } from '@/domain/types';
import { bikeTypeLabel, categoryLabel, locationLabel, modeLabel, slotLabel } from '@/domain/catalog';
import { canPerform } from '@/domain/logic/requests';
import { formatDateTime, formatLongDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { Button, Card, KeyValue, Textarea, cx } from '@/components/ui';

export function RequestSummary({ request }: { request: ServiceRequest }) {
  const r = request;
  return (
    <Card className="p-5">
      <h2 className="font-bold">Detalles</h2>
      <dl className="mt-2 divide-y divide-line">
        <KeyValue label="Servicio">{categoryLabel(r.category)}</KeyValue>
        <KeyValue label="Problema">
          <span className="whitespace-pre-line">{r.description}</span>
        </KeyValue>
        <KeyValue label={r.category === 'inspection' ? 'Bici a inspeccionar' : 'Bici'}>
          <span className="font-medium">
            {r.bike.name ? `${r.bike.name} · ` : ''}
            {r.bike.brand} {r.bike.model}
          </span>
          <span className="text-muted">
            {' '}
            · {bikeTypeLabel(r.bike.type)}
            {r.bike.year ? ` · ${r.bike.year}` : ''}
          </span>
          {r.bike.notes && <span className="mt-1 block text-sm text-muted">{r.bike.notes}</span>}
        </KeyValue>
        {r.inspection && (r.inspection.askingPrice || r.inspection.sellerLocation || r.inspection.listingReference) && (
          <KeyValue label="Compra">
            {r.inspection.askingPrice ? <span className="block">Precio pedido: {formatPrice(r.inspection.askingPrice)}</span> : null}
            {r.inspection.sellerLocation ? <span className="block">Ubicación: {r.inspection.sellerLocation}</span> : null}
            {r.inspection.listingReference ? <span className="block text-muted">{r.inspection.listingReference}</span> : null}
          </KeyValue>
        )}
        <KeyValue label="Dónde">
          {modeLabel(r.mode)} · {locationLabel(r.location)}
        </KeyValue>
        <KeyValue label="Disponibilidad">
          {r.availability.preferredDate && <span className="block">Prefiere el {formatLongDate(r.availability.preferredDate)}</span>}
          <span className="block">
            {r.availability.timeSlots.map(slotLabel).join(', ') || 'Sin franja concreta'}
            {r.availability.flexible ? ' · flexible' : ''}
          </span>
          {r.availability.notes && <span className="block text-sm text-muted">{r.availability.notes}</span>}
        </KeyValue>
      </dl>
    </Card>
  );
}

export function ProposalCard({ proposal, highlight, children }: { proposal: Proposal; highlight?: boolean; children?: ReactNode }) {
  const statusText: Record<Proposal['status'], string> = {
    pending: 'Pendiente de tu respuesta',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    withdrawn: 'Sustituida',
  };
  return (
    <section
      className={cx('rounded-3xl border p-5 sm:p-6', highlight ? 'border-ink bg-paper shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line')}
      aria-labelledby={`proposal-${proposal.id}`}
      data-testid="proposal-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={`proposal-${proposal.id}`} className="font-bold">
          Propuesta del mecánico
        </h2>
        <span className="text-xs font-medium text-muted">{statusText[proposal.status]}</span>
      </div>
      <p className="mt-3 font-display text-4xl font-extrabold" data-testid="proposal-price">
        {formatPrice(proposal.price)}
      </p>
      <p className="text-sm text-muted">Precio propuesto. En la demo no se gestiona ningún pago.</p>
      <div className="mt-4 grid grid-cols-1 gap-2 text-[15px] sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted" aria-hidden />
          <span className="first-letter:uppercase">{formatLongDate(proposal.date)}</span>
        </p>
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-muted" aria-hidden />
          {proposal.time}
          {proposal.durationMinutes ? ` · ≈ ${proposal.durationMinutes} min` : ''}
        </p>
      </div>
      <blockquote className="mt-4 rounded-2xl bg-sand p-4 text-[15px] leading-relaxed">“{proposal.message}”</blockquote>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function eventText(e: RequestEvent, mechanicName: string, ownerName: string, request: ServiceRequest): { title: string; body?: string } {
  const first = (n: string) => n.split(' ')[0];
  switch (e.type) {
    case 'created':
      return { title: `${first(ownerName)} envió la solicitud` };
    case 'accepted_for_review':
      return { title: `${first(mechanicName)} aceptó valorar la solicitud` };
    case 'proposal_sent': {
      const p = request.proposals.find((x) => Math.abs(new Date(x.createdAt).getTime() - new Date(e.at).getTime()) < 6 * 3600_000);
      return { title: p ? `Propuesta enviada: ${formatPrice(p.price)}` : 'Propuesta enviada', body: e.text };
    }
    case 'proposal_accepted':
      return { title: `${first(ownerName)} aceptó la propuesta. Cita confirmada.` };
    case 'proposal_rejected':
      return { title: `${first(ownerName)} rechazó la propuesta`, body: e.text };
    case 'started':
      return { title: 'Trabajo en curso' };
    case 'completed':
      return { title: 'Trabajo completado', body: e.text };
    case 'cancelled_by_owner':
      return { title: `${first(ownerName)} canceló la solicitud`, body: e.text };
    case 'rejected_by_mechanic':
      return { title: `${first(mechanicName)} no puede atender esta solicitud`, body: e.text };
    case 'message':
      return { title: e.by === 'mechanic' ? first(mechanicName) : first(ownerName), body: e.text };
  }
}

export function RequestTimeline({
  request,
  mechanicName,
  ownerName,
  viewer,
}: {
  request: ServiceRequest;
  mechanicName: string;
  ownerName: string;
  viewer: Role;
}) {
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const canMessage = canPerform(request, 'message', viewer);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await actOnRequest(request.id, { type: 'message', text, by: viewer });
      setText('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo enviar el mensaje', 'error');
    } finally {
      setSending(false);
    }
  };

  const events = [...request.events].reverse();
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <MessageSquare className="size-4" aria-hidden /> Actividad y mensajes
      </h2>
      {canMessage && (
        <form onSubmit={send} className="mt-4">
          <label htmlFor={`msg-${request.id}`} className="sr-only">
            Escribe un mensaje
          </label>
          <Textarea
            id={`msg-${request.id}`}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={viewer === 'owner' ? `Escribe a ${mechanicName.split(' ')[0]}…` : `Escribe a ${ownerName.split(' ')[0]}…`}
            maxLength={500}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted">Mensajes simples, sin chat en tiempo real.</p>
            <Button type="submit" size="sm" variant="dark" loading={sending} disabled={!text.trim()} icon={<Send className="size-3.5" aria-hidden />}>
              Enviar
            </Button>
          </div>
        </form>
      )}
      <ol className="mt-5 space-y-0">
        {events.map((e, i) => {
          const t = eventText(e, mechanicName, ownerName, request);
          const isMessage = e.type === 'message';
          const mine = e.by === viewer;
          return (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < events.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-line" aria-hidden />}
              <span className={cx('relative mt-1 size-[15px] shrink-0 rounded-full border-2', i === 0 ? 'border-ink bg-lime' : 'border-line-strong bg-paper')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{t.title}</span>
                  {isMessage && mine && <span className="text-muted"> (tú)</span>}
                  <span className="text-muted"> · {formatDateTime(e.at)}</span>
                </p>
                {t.body && <p className={cx('mt-1 text-[15px] leading-relaxed', isMessage ? 'rounded-2xl bg-sand px-3.5 py-2.5' : 'text-muted')}>{t.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
