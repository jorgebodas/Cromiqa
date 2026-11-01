import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ArrowUpRight, CalendarCheck, ChevronRight, ClipboardList, Loader2, Plus, Send, X } from 'lucide-react';
import { HubActionContext, type HubActionApi, type HubPrimaryMeta } from './hubAction';
import type { ID, ServiceRequest } from '@/domain/types';
import { bikeLabel, categoryLabel } from '@/domain/catalog';
import { DomainError, currentProposal } from '@/domain/logic/requests';
import { caseHref, threadHref } from '@/domain/logic/cases';
import { hubItems, type HubItem, type QuickScreen } from '@/domain/logic/hub';
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

/** Whether the person asked the system for less motion (live: follows the setting). */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * One line of text that slowly slides to reveal its end when it doesn't fit, then slides back:
 * pause 1.5 s, scroll (5–7 s, by length), pause 1 s, return (1.2 s). Static when it fits or when
 * the system asks for reduced motion (then it wraps to two lines). Paused while hovered/pressed.
 * Restarts only when the text or the available width change.
 */
export function Marquee({ text, className, wrapClassName }: { text: string; className?: string; wrapClassName?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);
  const [overflow, setOverflow] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const measure = () => {
      if (!box.current || !probe.current) return;
      setOverflow(Math.max(0, Math.ceil(probe.current.scrollWidth - box.current.clientWidth)));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (box.current) ro?.observe(box.current);
    return () => ro?.disconnect();
  }, [text]);

  useEffect(() => {
    const el = line.current;
    if (!el || overflow < 2 || reduced || typeof el.animate !== 'function') return;
    const travel = overflow + 14; // past the fade on the right edge
    const [hold, scroll, rest, back] = [1500, Math.min(7000, Math.max(5000, travel * 45)), 1000, 1200];
    const total = hold + scroll + rest + back;
    const at = (t: number) => t / total;
    anim.current = el.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: at(hold), easing: 'cubic-bezier(.45,0,.55,1)' },
        { transform: `translateX(${-travel}px)`, offset: at(hold + scroll) },
        { transform: `translateX(${-travel}px)`, offset: at(hold + scroll + rest), easing: 'cubic-bezier(.45,0,.55,1)' },
        { transform: 'translateX(0)', offset: 1 },
      ],
      { duration: total, iterations: Infinity },
    );
    return () => {
      anim.current?.cancel();
      anim.current = null;
    };
  }, [overflow, reduced, text]);

  const moving = overflow >= 2 && !reduced;
  const wraps = overflow >= 2 && reduced;
  return (
    <span
      ref={box}
      className={cx('relative block min-w-0 overflow-hidden', className)}
      style={moving ? { maskImage: 'linear-gradient(to right, transparent 0, #000 6px, #000 calc(100% - 18px), transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent 0, #000 6px, #000 calc(100% - 18px), transparent)' } : undefined}
      onPointerEnter={() => anim.current?.pause()}
      onPointerDown={() => anim.current?.pause()}
      onPointerLeave={() => anim.current?.play()}
      onPointerCancel={() => anim.current?.play()}
      data-testid="marquee"
      data-moving={moving || undefined}
      aria-hidden
    >
      {/* Invisible copy on one line, only to measure whether the text fits. */}
      <span ref={probe} className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap">
        {text}
      </span>
      <span ref={line} className={cx(wraps ? cx('line-clamp-2 whitespace-normal break-words', wrapClassName) : 'block whitespace-nowrap', moving && 'pl-[6px] will-change-transform')}>
        {text}
      </span>
    </span>
  );
}

/** What the chip says (one message for the most important request) and the full sentence for screen readers. */
function chipText(items: HubItem[]) {
  const top = items[0]!;
  const others = items.length - 1;
  const spoken = `${top.label} · ${categoryLabel(top.lead.category)}.${others ? ` ${others} ${others === 1 ? 'solicitud activa más' : 'solicitudes activas más'}.` : ''} ${others ? 'Abrir tus solicitudes' : 'Abrir'}`;
  return { top, others, spoken };
}

/** Light yellow-to-lilac glow with a hairline: the chip's background. */
const pillSurface =
  'bg-[radial-gradient(130%_160%_at_0%_0%,#efffa8_0%,rgb(239_255_168/0)_55%),radial-gradient(120%_160%_at_100%_100%,#e6e9ff_0%,rgb(230_233_255/0)_60%),linear-gradient(#fffdf0,#fffdf0)] text-ink shadow-[0_0_0_1px_rgb(23_23_23/0.06),0_8px_24px_rgb(0_0_0/0.12)]';

/** Where a tap goes: one request → its next action (a screen in the hub, or the chat/page); several → the overview. */
function useOpenChip() {
  const openHub = useNavUi((s) => s.openHub);
  const navigate = useNavigate();
  return (items: HubItem[]) => {
    if (items.length > 1) return openHub({ kind: 'overview' });
    const { quick, caseId } = items[0]!;
    if (quick.href) return navigate(quick.href);
    openHub({ kind: 'detail', caseId, screen: quick.screen });
  };
}

/**
 * The Request Hub pill, right of the floating navigation while requests are active: one
 * message for the most important request, "+N" for the other active requests, and a chevron.
 * One message, one priority, one destination. (With nothing active the dock shows "+ Nueva".)
 */
export function FloatingRequestHub({
  items,
  className,
  style,
  hubRef,
  current,
  contentClassName,
}: {
  items: HubItem[];
  className?: string;
  style?: CSSProperties;
  hubRef?: Ref<HTMLButtonElement>;
  /** On the Requests screens: the hub stands for that section. */
  current?: boolean;
  /** For the dock's transition: the text, counter and chevron fade in/out together. */
  contentClassName?: string;
}) {
  const open = useOpenChip();
  const { top, others, spoken } = chipText(items);
  return (
    <button
      ref={hubRef}
      type="button"
      onClick={() => open(items)}
      aria-label={spoken}
      aria-current={current ? 'page' : undefined}
      className={cx(
        'pointer-events-auto flex h-16 min-w-0 items-center gap-1.5 rounded-full pl-4 pr-3 text-left transition-transform active:scale-[0.97]',
        pillSurface,
        current && 'shadow-[0_0_0_1.5px_rgb(23_23_23/0.22),0_8px_24px_rgb(0_0_0/0.12)]',
        className,
      )}
      style={style}
      data-testid="request-hub-chip"
      data-state={items.length > 1 ? 'multiple' : 'single'}
      data-situation={top.quick.situation}
    >
      {/* For the dock's morph only (hidden otherwise): a white veil matching the nav pill, and the
          Solicitudes icon the Hub grows out of and shrinks back into. */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-paper opacity-0" data-hub-veil aria-hidden />
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-center text-[#7a7a7a] opacity-0" data-hub-icon aria-hidden>
        <ClipboardList className="size-[26px]" strokeWidth={2} />
      </span>
      <span className={cx('relative flex min-w-0 flex-1 items-center gap-1.5', contentClassName)} data-hub-content>
        <Marquee
          text={top.label}
          className={cx('flex-1 font-display text-[15px] leading-tight tracking-[-0.01em]', top.pending ? 'font-bold text-ink' : 'font-semibold text-ink/75')}
          wrapClassName="text-[12px] leading-[1.2]"
        />
        {others > 0 && (
          <span className="shrink-0 pl-1 text-[13px] font-semibold tabular-nums text-ink/50" data-testid="hub-counter">
            +{others}
          </span>
        )}
        <ChevronRight className="size-[18px] shrink-0 text-ink/40" strokeWidth={2.4} aria-hidden />
      </span>
    </button>
  );
}

/** The dock's right side when nothing is active: "+ Nueva", opening the usual new-request flow. */
export function NewRequestPill({ className, style, pillRef }: { className?: string; style?: CSSProperties; pillRef?: Ref<HTMLButtonElement> }) {
  const openHub = useNavUi((s) => s.openHub);
  return (
    <button
      ref={pillRef}
      type="button"
      onClick={() => openHub({ kind: 'new' })}
      aria-label="Nueva solicitud"
      className={cx('float-pill pointer-events-auto flex h-16 shrink-0 items-center gap-1.5 rounded-full pl-5 pr-6 font-display text-[16px] font-bold tracking-[-0.01em] text-ink transition-transform active:scale-95', className)}
      style={{ backgroundColor: 'var(--color-lime)', ...style }}
      data-testid="new-request-fab"
    >
      <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
      Nueva
    </button>
  );
}

/** Desktop header: the same message and counter, smaller; it takes the place of "Nueva solicitud" and "Solicitudes". */
export function HeaderRequestChip() {
  const items = useHubItems();
  const open = useOpenChip();
  if (!items.length) return null;
  const { top, others, spoken } = chipText(items);
  return (
    <button
      type="button"
      onClick={() => open(items)}
      aria-label={spoken}
      className={cx('inline-flex h-10 w-[min(300px,28vw)] min-w-[180px] items-center gap-1.5 rounded-full pl-4 pr-2.5 text-left text-sm transition-opacity hover:opacity-90', pillSurface)}
      data-testid="header-hub-chip"
      data-situation={top.quick.situation}
    >
      <Marquee text={top.label} className={cx('flex-1 font-display tracking-[-0.01em]', top.pending ? 'font-bold' : 'font-semibold text-ink/75')} wrapClassName="text-xs leading-tight" />
      {others > 0 && <span className="shrink-0 text-xs font-semibold tabular-nums text-ink/50">+{others}</span>}
      <ChevronRight className="size-4 shrink-0 text-ink/40" strokeWidth={2.4} aria-hidden />
    </button>
  );
}

function StatusChip({ item }: { item: HubItem }) {
  return (
    <span className={cx('inline-flex max-w-full items-center truncate rounded-full px-2.5 py-1 text-xs font-semibold', item.pending ? 'bg-lime text-ink' : 'bg-canvas text-ink')}>{item.label}</span>
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

/** A widget card, as on the Home screens: title top-left, optional element top-right. */
function HubCard({ title, aside, children, className, testId }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cx('surface rounded-[22px] p-4 sm:p-5', className)} data-testid={testId}>
      {(title || aside) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <h3 className="font-display text-[17px] font-semibold leading-tight tracking-tight">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** While requests are active the Solicitudes tab is the Hub itself: this keeps the full list (and history) one tap away. */
function AllRequestsLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mx-auto mt-4 flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink" data-testid="hub-all-requests">
      Ver todas tus solicitudes <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}

function Overview({ items, onOpen, onAll }: { items: HubItem[]; onOpen: (item: HubItem) => void; onAll: () => void }) {
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
    <>
      <ul className="space-y-3" data-testid="hub-overview">
        {items.map((item, i) => {
          const quotes = item.threads.filter((r) => r.status === 'proposal_received');
          // The one the floating chip talks about: first, and gently highlighted.
          const primary = i === 0 && items.length > 1;
          const info =
            quotes.length > 1
              ? `Desde ${formatPrice(Math.min(...quotes.map((r) => currentProposal(r)?.price ?? 0)))}`
              : item.threads.length === 1 || ['confirmed', 'in_progress', 'awaiting_completion'].includes(item.lead.status)
                ? name(item.lead.mechanicId)
                : `${item.threads.length} mecánicos invitados`;
          return (
            <li key={item.caseId}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cx('surface block w-full rounded-[22px] p-4 text-left sm:p-5', primary && 'shadow-[0_0_0_2px_#d8f560,var(--shadow-surface)]')}
                data-testid="hub-item"
                data-primary={primary || undefined}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-[17px] font-semibold leading-tight tracking-tight">{categoryLabel(item.lead.category)}</span>
                  <ArrowUpRight className="size-[18px] shrink-0 text-muted" aria-hidden />
                </span>
                <span className="mt-4 flex items-center gap-2">
                  <StatusChip item={item} />
                </span>
                <span className="mt-2 block truncate text-sm text-muted">
                  {bikeLabel(item.lead.bike)} · {info}
                </span>
                {item.action && <span className="mt-1 block text-[15px] font-semibold">{item.action}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <AllRequestsLink onClick={onAll} />
    </>
  );
}

function Detail({ item, onGo }: { item: HubItem; onGo: (to: string) => void }) {
  const mechanics = useApp((s) => s.db.mechanics);
  const name = (id: ID) => mechanics.find((m) => m.id === id)?.name ?? 'Mecánico';
  const hired = item.threads.find((r) => ['confirmed', 'in_progress', 'awaiting_completion'].includes(r.status));
  const appt = hired?.appointment?.confirmed;
  const r = item.lead;
  return (
    <div className="space-y-3" data-testid="hub-detail">
      <HubCard title="Tu solicitud" aside={<StatusChip item={item} />}>
        {item.action && <p className="text-lg font-bold leading-snug">{item.action}</p>}
        <p className={cx('line-clamp-3 text-[15px] text-muted', item.action && 'mt-1')}>{r.description}</p>
        <p className="mt-2 text-sm text-muted">{bikeLabel(r.bike)}</p>
        {r.photos && r.photos.length > 0 && <PhotoStrip photos={r.photos} />}
      </HubCard>
      {appt && (
        <HubCard title="Cita">
          <p className="flex items-center gap-2 text-[15px] font-semibold first-letter:uppercase">
            <CalendarCheck className="size-5 shrink-0 text-lime-text" aria-hidden />
            {formatDate(appt.date, { weekday: 'long', day: 'numeric', month: 'long' })}, {appt.time}
          </p>
        </HubCard>
      )}
      <HubCard title={item.threads.length === 1 ? 'Mecánico' : `${item.threads.length} mecánicos`}>
        <ul className="-mx-4 -mb-4 divide-y divide-line sm:-mx-5 sm:-mb-5">
          {item.threads.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onGo(threadHref(t))} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas/60 sm:px-5">
                <Avatar name={name(t.mechanicId)} size="sm" className="size-9" />
                <span className="min-w-0 flex-1 truncate font-medium">{name(t.mechanicId)}</span>
                <span className="shrink-0 text-sm font-semibold">{answer(t)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </HubCard>
      <AllRequestsLink onClick={() => onGo('/solicitudes')} />
    </div>
  );
}

/** Back: a bare chevron, no circle or shadow. */
const plainBackClass =
  '-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
/** Close (and +): a small soft grey circle, top right. */
const softCircleClass =
  'flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const TITLES: Record<HubView['kind'], string> = { overview: 'Tus solicitudes', detail: 'Solicitud', new: 'Nueva solicitud' };
const SCREEN_TITLES: Record<QuickScreen, string> = {
  compare: 'Presupuestos',
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
          <article key={r.id} className="surface rounded-[22px] p-4 sm:p-5" data-testid="quick-quote">
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
    <div className="space-y-3" data-testid={`quick-${screen}`}>
      <HubCard title={categoryLabel(item.lead.category)} aside={<StatusChip item={item} />}>
        <p className="truncate text-sm text-muted">
          {bikeLabel(item.lead.bike)}
          {screen !== 'compare' ? ` · ${mechanicName}` : ''}
        </p>
        {item.action && <p className="mt-1 text-[15px] font-semibold">{item.action}</p>}
      </HubCard>
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
  // The form (in "new") drives the bottom row through these.
  const runRef = useRef<() => void>(() => {});
  const backRef = useRef<() => void>(() => {});
  const [formMeta, setFormMeta] = useState<HubPrimaryMeta | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const api = useMemo<HubActionApi>(() => ({ runRef, backRef, setMeta: setFormMeta, headerSlot }), [headerSlot]);
  // The primary action's label fades in right after opening.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) return setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
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
  const screen = shown.kind === 'detail' && shown.screen && shown.screen !== 'status' ? shown.screen : undefined;
  const toNew = () => openHub({ kind: 'new', from: 'overview' });

  // The bottom row's primary button: set here for the hub's own views, by the form in "new".
  let body: ReactNode;
  let primary: HubPrimaryMeta | null = null;
  let run: () => void = () => {};
  if (shown.kind === 'overview') {
    body = <Overview items={items} onAll={() => go('/solicitudes')} onOpen={(item) => (item.quick.href ? go(item.quick.href) : openHub({ kind: 'detail', caseId: item.caseId, screen: item.quick.screen }))} />;
    primary = { label: 'Nueva solicitud', icon: 'plus', canBack: false };
    run = toNew;
  } else if (shown.kind === 'detail' && detailItem) {
    body = screen ? (
      <QuickScreenView item={detailItem} screen={screen} onGo={go} onSummary={() => openHub({ kind: 'detail', caseId: detailItem.caseId })} onScreen={(next) => openHub({ kind: 'detail', caseId: detailItem.caseId, screen: next })} />
    ) : (
      <Detail item={detailItem} onGo={go} />
    );
    primary = { label: screen ? 'Ver solicitud completa' : detailItem.pending ? 'Ver y responder' : 'Ver solicitud', icon: 'arrow', canBack: true };
    run = () => go(caseHref(detailItem.lead));
  } else {
    body = (
      <RequestForm
        variant="overlay"
        onSent={() => closeHub()}
        onBackFromStart={shown.kind === 'new' && shown.from === 'overview' ? () => openHub({ kind: 'overview' }) : undefined}
      />
    );
  }
  const meta = shown.kind === 'new' ? formMeta : primary;
  const onPrimary = shown.kind === 'new' ? () => runRef.current() : run;
  const onBack = shown.kind === 'new' ? () => backRef.current() : () => openHub({ kind: 'overview' });
  const PrimaryIcon = meta?.icon === 'plus' ? Plus : meta?.icon === 'send' ? Send : ArrowRight;

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="request-hub">
      <div className="cq-fade-in absolute inset-0 bg-[linear-gradient(to_top,rgb(23_23_23/0.32),rgb(23_23_23/0.12)_45%,rgb(23_23_23/0.02))] backdrop-blur-[2px]" onClick={requestClose} aria-hidden />
      {/*
        One container: on phones the floating bar itself grows into the panel. Its bottom row is
        the bar transformed: the tabs pill shrinks into the close button and the + stretches into
        the primary action. On desktop it's a side panel with the same row at the bottom.
      */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hub-title"
        className="glass-card cq-sheet-up absolute inset-x-2 bottom-[max(10px,env(safe-area-inset-bottom))] top-[max(12px,env(safe-area-inset-top))] mx-auto flex max-w-md origin-bottom flex-col rounded-[30px] md:top-auto md:h-[min(88dvh,820px)]"
      >
        {/* Back and close up top, quiet; the bottom is only for the main action. */}
        <header className="flex items-center gap-2 px-6 pb-3 pt-7">
          {meta?.canBack ? (
            <button type="button" onClick={onBack} aria-label={shown.kind === 'new' ? 'Atrás' : 'Volver a tus solicitudes'} className={plainBackClass}>
              <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            // Forms keep their progress bar centred even without a back button.
            shown.kind === 'new' && <span className="-ml-2 size-10 shrink-0" aria-hidden />
          )}
          <h2
            id="hub-title"
            tabIndex={-1}
            data-autofocus
            className={cx(
              'min-w-0 flex-1 truncate font-display text-xl font-extrabold leading-tight tracking-tight outline-none',
              // Forms show their progress up here instead of a title.
              shown.kind === 'new' && 'sr-only',
            )}
          >
            {screen ? SCREEN_TITLES[screen] : shown.kind === 'detail' && detailItem ? categoryLabel(detailItem.lead.category) : TITLES[shown.kind]}
          </h2>
          {shown.kind === 'new' && <div ref={setHeaderSlot} className="min-w-0 flex-1 px-2" data-testid="hub-progress" />}
          {shown.kind === 'detail' && (
            <button type="button" onClick={toNew} aria-label="Nueva solicitud" className={softCircleClass}>
              <Plus className="size-[18px]" aria-hidden />
            </button>
          )}
          <button type="button" onClick={requestClose} aria-label="Cerrar" className={softCircleClass}>
            <X className="size-[18px]" aria-hidden />
          </button>
        </header>
        <HubActionContext.Provider value={api}>
          <div data-hub-scroll className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            {body}
          </div>
        </HubActionContext.Provider>

        {/* The main action, full width. Looks disabled until the required fields are filled; tapping it then shows what's missing on the fields. */}
        <div className="flex items-center px-6 pb-6 pt-2">
          {meta && (
            <button
              type="button"
              onClick={onPrimary}
              disabled={meta.loading}
              aria-disabled={meta.disabled || undefined}
              className={cx(
                'flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-[28px] text-[15px] font-semibold transition-[transform,background-color,color] active:scale-[0.97] disabled:opacity-70',
                meta.disabled ? 'bg-line text-muted' : 'dock-btn-lime text-ink',
              )}
              data-testid="hub-primary"
            >
              {meta.loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : meta.icon === 'plus' && <PrimaryIcon className="size-5" aria-hidden />}
              <span className={cx('truncate transition-opacity duration-300', entered ? 'opacity-100' : 'opacity-0')}>{meta.label}</span>
              {!meta.loading && meta.icon === 'send' && <PrimaryIcon className="size-5" aria-hidden />}
            </button>
          )}
        </div>
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
