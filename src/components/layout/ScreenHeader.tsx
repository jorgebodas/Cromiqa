import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cx } from '@/components/ui';

/** Round header button (Fitness-style): use for every action in a screen header. */
export const headerButtonClass =
  'relative flex size-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink shadow-[var(--shadow-surface)] transition-shadow hover:shadow-[var(--shadow-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/**
 * Round "back" button. Steps back in history when the user came from inside the app, and
 * goes to `fallback` when the screen was opened directly by URL.
 */
function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Link
      to={fallback}
      aria-label="Volver"
      onClick={(e) => {
        if (location.key === 'default') return;
        e.preventDefault();
        navigate(-1);
      }}
      className={headerButtonClass}
    >
      <ChevronLeft className="size-6" aria-hidden />
    </Link>
  );
}

interface ScreenHeaderProps {
  /** Short screen name (two words at most). */
  title: ReactNode;
  /** Detail screens: where "back" goes when there is no history to return to. */
  back?: string;
  /** Main screens: a round button on the left (the profile avatar). Detail screens use `back`. */
  leading?: ReactNode;
  /** Round buttons on the right (use `headerButtonClass`). */
  actions?: ReactNode;
  /** Optional line under the title. */
  description?: ReactNode;
}

/** Title size at rest and once it has settled in the top bar (px). */
const BIG = 34;
const SMALL = 20;

/**
 * The one header pattern used by every screen of the app: a top row with round buttons (back
 * or avatar on the left, actions on the right) and, below it, the screen name as a large title.
 *
 * The title is one element tied to the scroll: as soon as the page moves it starts shrinking
 * while it scrolls up, and when it reaches the top row it stops there at its small size (next
 * to the back button, if any) while the row turns into a white bar. No second copy, no jump.
 *
 * Render it as the first child of a screen, outside the screen's own container, so the bar
 * can stay pinned for the whole page.
 */
export function ScreenHeader({ title, back, leading, actions, description }: ScreenHeaderProps) {
  const bar = useRef<HTMLDivElement>(null);
  const lead = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    let start = 0; // distance from the title's resting centre to the bar's centre, at the top of the page
    const update = (force = false) => {
      const b = bar.current?.getBoundingClientRect();
      const s = slot.current?.getBoundingClientRect();
      const h = heading.current;
      if (!b || !s || !h) return;
      const target = b.top + b.height / 2;
      const natural = s.top + s.height / 2; // where the title would be without any effect
      if (window.scrollY <= 1 || !start) start = Math.max(natural - target, 1);
      const dxEnd = lead.current ? lead.current.offsetWidth + 12 : 0;
      if (natural <= target) {
        // Settled in the bar: pin it there once (fixed, like the bar) so further scrolling
        // doesn't touch it at all, until the page comes back down to where it left.
        if (h.dataset.pinned && !force) return;
        h.dataset.pinned = '1';
        Object.assign(h.style, {
          position: 'fixed',
          top: `${target - s.height / 2}px`,
          left: `${s.left}px`,
          width: `${s.width}px`,
          transform: `translate3d(${dxEnd}px, 0, 0) scale(${SMALL / BIG})`,
        });
        setCompact(true);
        return;
      }
      if (h.dataset.pinned) {
        delete h.dataset.pinned;
        Object.assign(h.style, { position: '', top: '', left: '', width: '' });
      }
      const p = Math.min(Math.max(1 - (natural - target) / start, 0), 1);
      const scale = 1 - p * (1 - SMALL / BIG);
      h.style.transform = `translate3d(${p * dxEnd}px, 0, 0) scale(${scale})`;
      setCompact(false);
    };
    const onResize = () => update(true);
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update());
    };
    update();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <div
        ref={bar}
        className={cx(
          'sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 md:top-16',
          compact ? 'bg-paper shadow-[0_1px_0_var(--color-line)]' : 'bg-transparent',
        )}
        data-testid="screen-bar"
        data-compact={compact || undefined}
      >
        <div className="container-page relative flex h-16 items-center gap-3">
          {(back || leading) && (
            <div ref={lead} className="flex shrink-0">
              {back ? <BackButton fallback={back} /> : leading}
            </div>
          )}
          <span className="flex-1" />
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="container-page pb-3">
        <div ref={slot} className="relative z-40 h-[42px]">
          <h1
            ref={heading}
            className="pointer-events-none max-w-full origin-left truncate font-display text-[34px] font-bold leading-[42px] tracking-[-0.02em] will-change-transform"
            data-testid="screen-title"
          >
            {title}
          </h1>
        </div>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
    </>
  );
}
