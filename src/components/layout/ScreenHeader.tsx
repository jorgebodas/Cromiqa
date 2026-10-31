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
  /** Plain-text title for the compact bar, when `title` isn't a string. */
  compactTitle?: string;
  /** Detail screens: where "back" goes when there is no history to return to. */
  back?: string;
  /** Main screens: a round button on the left (the profile avatar). Detail screens use `back`. */
  leading?: ReactNode;
  /** Round buttons on the right (use `headerButtonClass`). */
  actions?: ReactNode;
  /** Optional line under the title. */
  description?: ReactNode;
}

/**
 * The one header pattern used by every screen of the app (Airbnb-style): a top row with
 * round buttons (back on the left on detail screens, actions on the right) and, on the line
 * below, the screen name as a large title. Scrolling pushes the title up into the top row,
 * where it settles in smaller type while the row turns into a white bar.
 *
 * Render it as the first child of a screen, outside the screen's own container, so the bar
 * can stay pinned for the whole page.
 */
export function ScreenHeader({ title, compactTitle, back, leading, actions, description }: ScreenHeaderProps) {
  const bar = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // 0 = title fully on its own line, 1 = title has gone up into the top row.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!bar.current || !heading.current) return;
        const h = heading.current.getBoundingClientRect();
        const covered = bar.current.getBoundingClientRect().bottom - h.top;
        setProgress(Math.min(Math.max(covered / h.height, 0), 1));
      });
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const name = compactTitle ?? (typeof title === 'string' ? title : '');
  const compact = progress >= 0.98;
  // The large title fades out over the first part of the push; only then does the small one
  // rise into the top row, so the two never show on top of each other.
  const leave = Math.min(progress / 0.55, 1);
  const arrive = Math.min(Math.max((progress - 0.6) / 0.4, 0), 1);

  return (
    <>
      <div
        ref={bar}
        className={cx(
          'sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 md:top-16',
          compact ? 'bg-paper shadow-[0_1px_0_var(--color-line)]' : 'bg-transparent',
        )}
        data-testid="screen-bar"
      >
        <div className="container-page relative flex h-16 items-center gap-3">
          {back ? <BackButton fallback={back} /> : leading}
          <p
            aria-hidden
            className="pointer-events-none min-w-0 flex-1 truncate font-display text-[22px] font-bold tracking-tight"
            style={{ opacity: arrive, transform: `translateY(${(1 - arrive) * 14}px)` }}
          >
            {name}
          </p>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
      <div className="container-page pb-5">
        <h1
          ref={heading}
          className="origin-left font-display text-[34px] font-bold leading-tight tracking-[-0.02em] sm:text-[40px]"
          style={{ opacity: 1 - leave, transform: `translateY(${-progress * 6}px) scale(${1 - progress * 0.12})` }}
        >
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
    </>
  );
}
