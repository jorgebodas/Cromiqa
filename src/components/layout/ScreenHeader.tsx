import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cx } from '@/components/ui';

/** Round header button (Fitness-style): use for every action in a screen header. */
export const headerButtonClass =
  'relative flex size-11 shrink-0 items-center justify-center rounded-full bg-sand text-ink transition-colors hover:bg-sand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

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
  /** Round buttons on the right (use `headerButtonClass`). */
  actions?: ReactNode;
  /** Optional line under the title. */
  description?: ReactNode;
}

/**
 * The one header pattern used by every screen of the app: the screen name as a large title
 * on the left with round action buttons on the right (detail screens add a round back button
 * on the left, above the title). When the title scrolls away, a compact bar stays pinned at
 * the top with the name in small type and the same buttons.
 *
 * Render it as the first child of a screen, outside the screen's own container, so the bar
 * can stay pinned for the whole page.
 */
export function ScreenHeader({ title, compactTitle, back, actions, description }: ScreenHeaderProps) {
  const bar = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!bar.current || !heading.current) return;
        // Top-level screens start with the title inside the bar's row, so they shrink once it
        // has slid a little under the bar; detail screens once the title has gone under it.
        const slack = back ? 0 : 24;
        setCompact(heading.current.getBoundingClientRect().bottom < bar.current.getBoundingClientRect().bottom - slack);
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
  }, [back]);

  const name = compactTitle ?? (typeof title === 'string' ? title : '');

  return (
    <>
      <div
        ref={bar}
        className={cx(
          'sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 md:top-16',
          compact ? 'bg-paper/90 shadow-[0_1px_0_var(--color-line)] backdrop-blur' : 'bg-transparent',
        )}
        data-testid="screen-bar"
      >
        <div className="container-page relative flex h-16 items-center gap-2">
          {back && <BackButton fallback={back} />}
          <p
            aria-hidden
            className={cx(
              'pointer-events-none min-w-0 flex-1 truncate text-[17px] font-bold transition-[opacity,transform] duration-200',
              back ? 'text-center' : 'text-left',
              compact ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
            )}
          >
            {name}
          </p>
          {/* Keeps a detail screen's small title centred when there are no buttons on the right. */}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : back && <span className="size-11 shrink-0" />}
        </div>
      </div>
      <div className={cx('container-page', back ? 'pb-5 pt-1' : '-mt-16 pb-5')}>
        <h1
          ref={heading}
          className={cx(
            'font-display text-[34px] font-extrabold leading-tight tracking-tight sm:text-[40px]',
            // Top-level screens share the row with the buttons, like Fitness.
            !back && 'flex min-h-16 items-center pr-40',
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
    </>
  );
}
