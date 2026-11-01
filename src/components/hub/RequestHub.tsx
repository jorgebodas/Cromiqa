import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ClipboardList, Loader2, Plus, Send, X } from 'lucide-react';
import { HubActionContext, type HubActionApi, type HubPrimaryMeta } from './hubAction';
import { categoryLabel } from '@/domain/catalog';
import { hubItems, type HubItem } from '@/domain/logic/hub';
import { useApp } from '@/state/store';
import { useCurrentUser, useRequestsFor } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useNavUi } from '@/state/ui';
import { RequestForm } from '@/pages/owner/request/RequestFlowPage';
import { Button, Dialog, cx } from '@/components/ui';

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

/** The same lime as the +, with the floating pills' soft shadow. */
const pillSurface = 'bg-lime text-ink shadow-[0_0_0_1px_rgb(23_23_23/0.05),0_8px_24px_rgb(0_0_0/0.14)]';

/** Where a tap goes: always the Requests section, the one place where requests are managed. */
function useOpenChip() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    if (pathname === '/solicitudes') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/solicitudes');
  };
}

/**
 * The Request Hub, inside the floating bar: the Solicitudes tab stretched into a lime capsule
 * with its icon and one message for the most important request. Tapping it opens Solicitudes. (With nothing active: a separate +.)
 */
export function FloatingRequestHub({ items, className, style, hubRef }: { items: HubItem[]; className?: string; style?: CSSProperties; hubRef?: Ref<HTMLButtonElement> }) {
  const open = useOpenChip();
  const { top, spoken } = chipText(items);
  return (
    <button
      ref={hubRef}
      type="button"
      onClick={open}
      aria-label={spoken}
      className={cx('pointer-events-auto flex min-w-0 items-center gap-1.5 overflow-hidden rounded-full bg-lime pr-3 text-left text-ink', className)}
      style={style}
      data-testid="request-hub-chip"
      data-state={items.length > 1 ? 'multiple' : 'single'}
      data-situation={top.quick.situation}
    >
      {/* The Solicitudes icon, in the same place as the tab it grew out of. */}
      <span className="flex size-14 shrink-0 items-center justify-center" aria-hidden>
        <ClipboardList className="size-[26px]" strokeWidth={2} />
      </span>
      {/* Just the message: the other active requests are in the accessible name and in Solicitudes. */}
      <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-2" data-hub-content>
        <Marquee
          text={top.label}
          className={cx('flex-1 font-display text-[15px] leading-tight tracking-[-0.01em]', top.pending ? 'font-bold text-ink' : 'font-semibold text-ink/75')}
          wrapClassName="text-[12px] leading-[1.2]"
        />
      </span>
    </button>
  );
}

/** The dock's right side when nothing is active: a round +, opening the usual new-request flow. */
export function NewRequestPill({ className, style, pillRef }: { className?: string; style?: CSSProperties; pillRef?: Ref<HTMLButtonElement> }) {
  const openHub = useNavUi((s) => s.openHub);
  return (
    <button
      ref={pillRef}
      type="button"
      onClick={() => openHub({ kind: 'new' })}
      aria-label="Nueva solicitud"
      className={cx('float-pill pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full text-ink transition-transform active:scale-95', className)}
      style={{ backgroundColor: 'var(--color-lime)', ...style }}
      data-testid="new-request-fab"
    >
      <Plus className="size-7" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** Desktop header: the same message and counter, smaller; it takes the place of "Nueva solicitud" and "Solicitudes". */
export function HeaderRequestChip() {
  const items = useHubItems();
  const open = useOpenChip();
  if (!items.length) return null;
  const { top, spoken } = chipText(items);
  return (
    <button
      type="button"
      onClick={open}
      aria-label={spoken}
      className={cx('inline-flex h-10 w-[min(300px,28vw)] min-w-[180px] items-center gap-1.5 rounded-full pl-4 pr-2.5 text-left text-sm transition-opacity hover:opacity-90', pillSurface)}
      data-testid="header-hub-chip"
      data-situation={top.quick.situation}
    >
      <Marquee text={top.label} className={cx('flex-1 font-display tracking-[-0.01em]', top.pending ? 'font-bold' : 'font-semibold text-ink/75')} wrapClassName="text-xs leading-tight" />
    </button>
  );
}

/** Back: a bare chevron, no circle or shadow. */
const plainBackClass =
  '-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
/** Close (and +): a small soft grey circle, top right. */
const softCircleClass =
  'flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * The new-request box: a large bottom sheet on phones, a side panel on desktop, without leaving
 * the page. (Requests are managed in one place, the Solicitudes screen; the Hub links there.)
 */
export function RequestHubOverlay() {
  const view = useNavUi((s) => s.hub);
  const closeHub = useNavUi((s) => s.closeHub);
  const draft = useApp((s) => s.draft);
  const resetDraft = useApp((s) => s.resetDraft);
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
    if (dirty) setConfirm(true);
    else closeHub();
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
  const meta = formMeta;
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
            <button type="button" onClick={() => backRef.current()} aria-label="Atrás" className={plainBackClass}>
              <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            // The progress bar stays centred even without a back button.
            <span className="-ml-2 size-10 shrink-0" aria-hidden />
          )}
          <h2
            id="hub-title"
            tabIndex={-1}
            data-autofocus
            // The progress bar stands in for the title (kept for screen readers).
            className="sr-only outline-none"
          >
            Nueva solicitud
          </h2>
          <div ref={setHeaderSlot} className="min-w-0 flex-1 px-2" data-testid="hub-progress" />
          <button type="button" onClick={requestClose} aria-label="Cerrar" className={softCircleClass}>
            <X className="size-[18px]" aria-hidden />
          </button>
        </header>
        <HubActionContext.Provider value={api}>
          <div data-hub-scroll className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
            <RequestForm variant="overlay" onSent={() => closeHub()} />
          </div>
        </HubActionContext.Provider>

        {/* The main action, full width. Looks disabled until the required fields are filled; tapping it then shows what's missing on the fields. */}
        <div className="flex items-center px-6 pb-6 pt-2">
          {meta && (
            <button
              type="button"
              onClick={() => runRef.current()}
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
