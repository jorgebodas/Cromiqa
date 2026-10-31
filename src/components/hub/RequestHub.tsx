import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, ChevronRight, ClipboardList, Plus, X } from 'lucide-react';
import type { ID, ServiceRequest } from '@/domain/types';
import { bikeLabel, categoryLabel } from '@/domain/catalog';
import { DomainError, currentProposal } from '@/domain/logic/requests';
import { caseHref, threadHref } from '@/domain/logic/cases';
import { hubItems, hubState, type HubItem, type QuickScreen } from '@/domain/logic/hub';
import { formatDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useRequestsFor } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useNavUi, type HubView } from '@/state/ui';
import { RequestForm } from '@/pages/owner/request/RequestFlowPage';
import { PhotoStrip, RequestTimeline } from '@/components/domain/RequestParts';
import { AppointmentCard, CompletionCard } from '@/components/domain/ServiceParts';
import { Avatar, Button, Dialog, cx } from '@/components/ui';

/** The signed-in cyclist's active requests, as hub items (empty for guests and mechanic mode). */
export function useHubItems(): HubItem[] {
  const user = useCurrentUser();
  const mode = useMode();
  const requests = useRequestsFor({ ownerId: user && mode === 'cyclist' ? user.id : '__none__' });
  return useMemo(() => hubItems(requests), [requests]);
}

const dot = (pending: boolean) => <span className={cx('size-2 shrink-0 rounded-full', pending ? 'bg-lime' : 'bg-paper/40')} aria-hidden />;

/**
 * The collapsed Request Hub, right of the floating navigation: a + when there's nothing
 * active, one request's status, or a count of active requests and how many need you.
 */
export function FloatingRequestHub({ className }: { className?: string }) {
  const items = useHubItems();
  const openHub = useNavUi((s) => s.openHub);
  const state = hubState(items);

  if (state.kind === 'empty') {
    return (
      <button
        type="button"
        onClick={() => openHub({ kind: 'new' })}
        aria-label="Nueva solicitud"
        className={cx('float-pill pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full text-ink transition-transform active:scale-95', className)}
        style={{ backgroundColor: 'var(--color-lime)' }}
        data-testid="new-request-fab"
      >
        <Plus className="size-7" strokeWidth={2.25} aria-hidden />
      </button>
    );
  }
  const single = state.kind === 'single';
  const line1 = single ? state.item.label : `${state.count} solicitudes`;
  const line2 = single ? categoryLabel(state.item.lead.category) : state.pending ? `${state.pending} ${state.pending === 1 ? 'pendiente' : 'pendientes'}` : 'Nada pendiente';
  const pending = single ? state.item.pending : state.pending > 0;
  return (
    <button
      type="button"
      onClick={() => openHub(single ? { kind: 'detail', caseId: state.item.caseId, screen: state.item.quick.screen } : { kind: 'overview' })}
      aria-label={single ? `Tu solicitud: ${line1}. ${line2}. Abrir` : `${line1}, ${line2}. Abrir tus solicitudes`}
      className={cx(
        'pointer-events-auto flex h-16 min-w-0 max-w-[168px] shrink items-center gap-2.5 rounded-full bg-ink pl-4 pr-5 text-left text-paper shadow-[0_8px_24px_rgb(0_0_0/0.22)] transition-transform active:scale-[0.97]',
        className,
      )}
      data-testid="request-hub-chip"
      data-state={state.kind}
    >
      {dot(pending)}
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight">{line1}</span>
        <span className="block truncate text-xs leading-tight text-paper/60">{line2}</span>
      </span>
    </button>
  );
}

/** Desktop header: the same status as a compact chip next to "Nueva solicitud". */
export function HeaderRequestChip() {
  const items = useHubItems();
  const openHub = useNavUi((s) => s.openHub);
  const state = hubState(items);
  if (state.kind === 'empty') return null;
  const single = state.kind === 'single';
  const pending = single ? state.item.pending : state.pending > 0;
  return (
    <button
      type="button"
      onClick={() => openHub(single ? { kind: 'detail', caseId: state.item.caseId, screen: state.item.quick.screen } : { kind: 'overview' })}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
      data-testid="header-hub-chip"
    >
      {dot(pending)}
      {single ? `${state.item.label} · ${categoryLabel(state.item.lead.category)}` : `${state.count} solicitudes${state.pending ? ` · ${state.pending} ${state.pending === 1 ? 'pendiente' : 'pendientes'}` : ''}`}
    </button>
  );
}

function StatusChip({ item }: { item: HubItem }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold', item.pending ? 'bg-lime text-ink' : 'bg-canvas text-ink')}>{item.label}</span>
  );
}

/** One provider's answer, in a few words. */
function answer(r: ServiceRequest): string {
  const p = currentProposal(r);
  if (['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status)) return 'Contratado';
  if (r.status === 'proposal_received' && p) return formatPrice(p.price);
  if (r.status === 'awaiting_proposal' && r.openProposal) return 'Te ha escrito';
  if (r.status === 'not_selected') return 'No seleccionado';
  if (r.status === 'cancelled') return 'No disponible';
  return 'Pendiente';
}

function Overview({ items, onOpen }: { items: HubItem[]; onOpen: (item: HubItem) => void }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const name = (id: ID) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  if (!items.length) {
    return (
      <div className="py-10 text-center">
        <ClipboardList className="mx-auto size-8 text-muted" aria-hidden />
        <p className="mt-3 font-semibold">No tienes solicitudes activas</p>
        <p className="mt-1 text-sm text-muted">Cuéntanos qué necesita tu bici y te ayudamos a encontrar mecánico.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3" data-testid="hub-overview">
      {items.map((item) => {
        const quotes = item.threads.filter((r) => r.status === 'proposal_received');
        const info =
          quotes.length > 1
            ? `Desde ${formatPrice(Math.min(...quotes.map((r) => currentProposal(r)?.price ?? 0)))}`
            : item.threads.length === 1 || ['confirmed', 'in_progress', 'awaiting_completion'].includes(item.lead.status)
              ? name(item.lead.mechanicId)
              : `${item.threads.length} mecánicos invitados`;
        return (
          <li key={item.caseId}>
            <button type="button" onClick={() => onOpen(item)} className="surface flex w-full items-center gap-3 p-4 text-left" data-testid="hub-item">
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{categoryLabel(item.lead.category)}</span>
                  <StatusChip item={item} />
                </span>
                <span className="mt-1 block truncate text-sm text-muted">
                  {bikeLabel(item.lead.bike)} · {info}
                </span>
                {item.action && <span className="mt-1.5 block text-sm font-semibold">{item.action}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Detail({ item, onGo }: { item: HubItem; onGo: (to: string) => void }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const name = (id: ID) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  const hired = item.threads.find((r) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status));
  const appt = hired?.appointment?.confirmed;
  const r = item.lead;
  return (
    <div className="space-y-4" data-testid="hub-detail">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted">{bikeLabel(r.bike)}</p>
          <StatusChip item={item} />
        </div>
        {item.action && <p className="mt-2 text-lg font-bold leading-snug">{item.action}</p>}
        <p className="mt-2 line-clamp-3 text-[15px] text-muted">{r.description}</p>
      </div>
      {appt && (
        <p className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-paper">
          <CalendarCheck className="size-5 text-lime" aria-hidden />
          <span>
            Cita: {formatDate(appt.date, { weekday: 'long', day: 'numeric', month: 'long' })}, {appt.time}
          </span>
        </p>
      )}
      {r.photos && r.photos.length > 0 && <PhotoStrip photos={r.photos} />}
      <section aria-label="Mecánicos">
        <h3 className="mb-2 text-sm font-semibold text-muted">{item.threads.length === 1 ? 'Mecánico' : `${item.threads.length} mecánicos`}</h3>
        <ul className="surface divide-y divide-line overflow-hidden">
          {item.threads.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onGo(threadHref(t))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas/60">
                <Avatar name={name(t.mechanicId)} size="sm" className="size-9" />
                <span className="min-w-0 flex-1 truncate font-medium">{name(t.mechanicId)}</span>
                <span className="shrink-0 text-sm font-semibold">{answer(t)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const TITLES: Record<HubView['kind'], string> = { overview: 'Tus solicitudes', detail: 'Solicitud', new: 'Nueva solicitud' };
const SCREEN_TITLES: Record<QuickScreen, string> = {
  compare: 'Comparar presupuestos',
  appointment: 'Cita',
  completion: 'Confirmar servicio',
  incident: 'Incidencia',
  tracking: 'Seguimiento',
  status: 'Solicitud',
};

/** Accepting one quote from the comparison: an explicit tap, never automatic. */
function CompareQuotes({ item, onGo, onAccepted }: { item: HubItem; onGo: (to: string) => void; onAccepted: () => void }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const actOnRequest = useApp((s) => s.actOnRequest);
  const toast = useApp((s) => s.toast);
  const [busy, setBusy] = useState<ID | null>(null);
  const quotes = item.threads
    .filter((r) => r.status === 'proposal_received' && currentProposal(r)?.status === 'pending')
    .sort((a, b) => (currentProposal(a)?.price ?? 0) - (currentProposal(b)?.price ?? 0));
  const name = (id: ID) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  const accept = async (r: ServiceRequest) => {
    setBusy(r.id);
    try {
      await actOnRequest(r.id, { type: 'accept_proposal' });
      toast(`Has contratado a ${name(r.mechanicId)}. Ahora acordad la cita.`);
      onAccepted();
    } catch (e) {
      toast(e instanceof DomainError ? e.message : 'No se pudo aceptar.', 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-3" data-testid="compare-quotes">
      {quotes.length > 1 && <p className="text-sm text-muted">Ordenados por precio. Al aceptar uno, los demás se cierran. Aceptar no es un pago.</p>}
      {quotes.map((r) => {
        const p = currentProposal(r)!;
        return (
          <article key={r.id} className="surface p-4" data-testid="quick-quote">
            <div className="flex items-center gap-3">
              <Avatar name={name(r.mechanicId)} size="sm" className="size-9" />
              <span className="min-w-0 flex-1 truncate font-semibold">{name(r.mechanicId)}</span>
              <span className="font-display text-2xl font-bold">{formatPrice(p.price)}</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Propone {formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {p.time}
              {r.proposals.length > 1 ? ` · versión ${r.proposals.length}` : ''}
            </p>
            <p className="mt-2 line-clamp-2 text-[15px]">{p.message}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => accept(r)} loading={busy === r.id} disabled={busy !== null}>
                Aceptar presupuesto
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onGo(threadHref(r))}>
                Ver conversación
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** A request's next meaningful action, opened straight from the chip. Reuses the request screens' parts. */
function QuickScreenView({
  item,
  screen,
  onGo,
  onSummary,
  onScreen,
}: {
  item: HubItem;
  screen: Exclude<QuickScreen, 'status'>;
  onGo: (to: string) => void;
  onSummary: () => void;
  onScreen: (screen: QuickScreen) => void;
}) {
  const user = useCurrentUser();
  const mechanics = useApp((s) => s.db.mechanics);
  const thread = item.threads.find((r) => r.id === item.quick.threadId) ?? item.lead;
  const mechanicName = mechanics.find((m) => m.id === thread.mechanicId)?.name ?? 'Mecánico';
  return (
    <div className="space-y-4" data-testid={`quick-${screen}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-muted">
          {categoryLabel(item.lead.category)} · {bikeLabel(item.lead.bike)}
          {screen !== 'compare' ? ` · ${mechanicName}` : ''}
        </p>
        <StatusChip item={item} />
      </div>
      {screen === 'compare' && <CompareQuotes item={item} onGo={onGo} onAccepted={() => onScreen('appointment')} />}
      {(screen === 'appointment' || screen === 'tracking') && ['confirmed', 'in_progress', 'awaiting_completion'].includes(thread.status) && (
        <AppointmentCard request={thread} viewer="owner" otherName={mechanicName} />
      )}
      {(screen === 'completion' || screen === 'incident') && <CompletionCard request={thread} viewer="owner" otherName={mechanicName} />}
      {(screen === 'tracking' || screen === 'incident') && <RequestTimeline request={thread} mechanicName={mechanicName} ownerName={user?.name ?? 'Tú'} viewer="owner" />}
      <button type="button" onClick={onSummary} className="text-sm font-semibold underline-offset-2 hover:underline">
        Ver resumen de la solicitud
      </button>
    </div>
  );
}

/**
 * The Request Hub panel: a large bottom sheet on phones, a side panel on desktop. Shows the
 * active requests, one request's summary, or the new-request form, without leaving the page.
 */
export function RequestHubOverlay() {
  const view = useNavUi((s) => s.hub);
  const openHub = useNavUi((s) => s.openHub);
  const closeHub = useNavUi((s) => s.closeHub);
  const draft = useApp((s) => s.draft);
  const resetDraft = useApp((s) => s.resetDraft);
  const items = useHubItems();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  const open = view !== null;
  const dirty = draft.description.trim().length > 0 || draft.step > 0 || draft.photos.length > 0;

  const requestClose = () => {
    if (view?.kind === 'new' && dirty) setConfirm(true);
    else closeHub();
  };
  const go = (to: string) => {
    closeHub();
    navigate(to);
  };

  // Focus in, Escape, focus trap, body scroll lock, focus restored on close.
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (confirmRef.current) return; // the confirmation dialog handles its own keys
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && node) {
        const els = Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
        if (!els.length) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!view) return null;
  const detailItem = view.kind === 'detail' ? items.find((i) => i.caseId === view.caseId) : undefined;
  // A request that stopped being active (e.g. completed) falls back to the overview.
  const shown: HubView = view.kind === 'detail' && !detailItem ? { kind: 'overview' } : view;
  // From a request (any screen) there's always a way back to the overview.
  const back = shown.kind === 'detail' ? () => openHub({ kind: 'overview' }) : undefined;
  const screen = shown.kind === 'detail' && shown.screen && shown.screen !== 'status' ? shown.screen : undefined;

  let body: ReactNode;
  let footer: ReactNode = null;
  if (shown.kind === 'overview') {
    body = <Overview items={items} onOpen={(item) => openHub({ kind: 'detail', caseId: item.caseId, screen: item.quick.screen })} />;
    footer = (
      <Button size="lg" block className="h-14 text-[17px]" icon={<Plus className="size-5" aria-hidden />} onClick={() => openHub({ kind: 'new', from: 'overview' })}>
        Nueva solicitud
      </Button>
    );
  } else if (shown.kind === 'detail' && detailItem && screen) {
    body = <QuickScreenView item={detailItem} screen={screen} onGo={go} onSummary={() => openHub({ kind: 'detail', caseId: detailItem.caseId })} onScreen={(next) => openHub({ kind: 'detail', caseId: detailItem.caseId, screen: next })} />;
    footer = (
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={() => openHub({ kind: 'new', from: 'overview' })}
          aria-label="Nueva solicitud"
          className="float-pill flex size-14 shrink-0 items-center justify-center rounded-full text-ink active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
        </button>
        <Button size="lg" variant="secondary" className="h-14 flex-1 text-[16px]" onClick={() => go(caseHref(detailItem.lead))}>
          Ver solicitud completa
        </Button>
      </div>
    );
  } else if (shown.kind === 'detail' && detailItem) {
    body = <Detail item={detailItem} onGo={go} />;
    footer = (
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={() => openHub({ kind: 'new', from: 'overview' })}
          aria-label="Nueva solicitud"
          className="float-pill flex size-14 shrink-0 items-center justify-center rounded-full text-ink active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
        </button>
        <Button size="lg" className="h-14 flex-1 text-[17px]" onClick={() => go(caseHref(detailItem.lead))}>
          {detailItem.pending ? 'Ver y responder' : 'Ver solicitud'}
        </Button>
      </div>
    );
  } else {
    body = (
      <RequestForm
        variant="overlay"
        onSent={() => closeHub()}
        onBackFromStart={shown.kind === 'new' && shown.from === 'overview' ? () => openHub({ kind: 'overview' }) : undefined}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="request-hub">
      <div className="cq-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={requestClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-title"
        className="cq-sheet-up absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col rounded-t-[28px] bg-paper shadow-pop md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[480px] md:rounded-l-[28px] md:rounded-tr-none"
      >
        <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <header className="flex items-center gap-2 px-5 pb-2 pt-3 sm:px-6 md:pt-6">
          {back && (
            <button type="button" onClick={back} aria-label="Volver a tus solicitudes" className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-canvas">
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          )}
          <h2 id="hub-title" tabIndex={-1} data-autofocus className="min-w-0 flex-1 truncate text-xl font-bold outline-none">
            {screen ? SCREEN_TITLES[screen] : shown.kind === 'detail' && detailItem ? categoryLabel(detailItem.lead.category) : TITLES[shown.kind]}
          </h2>
          <button type="button" onClick={requestClose} aria-label="Cerrar" className="-mr-2 flex size-10 items-center justify-center rounded-full hover:bg-canvas">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">{body}</div>
        {footer && <div className="border-t border-line px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:px-6">{footer}</div>}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Salir de la nueva solicitud?"
        description="Puedes guardarla como borrador y seguir más tarde desde «Nueva solicitud»."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Seguir editando
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetDraft();
                setConfirm(false);
                closeHub();
              }}
            >
              Descartar
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                closeHub();
              }}
            >
              Guardar borrador
            </Button>
          </>
        }
      >
        <span />
      </Dialog>
    </div>,
    document.body,
  );
}
