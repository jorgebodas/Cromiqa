import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from '@/components/ui';

interface WidgetProps {
  title: string;
  /** Small line under the title ("hoy", "en curso"…). */
  caption?: ReactNode;
  /** Where the whole card goes when tapped. */
  to?: string;
  /** Or what it does when tapped. */
  onClick?: () => void;
  /** 'half' takes one column of the two-column grid; 'full' spans both. */
  size?: 'half' | 'full';
  /** Dark card for something that needs attention. */
  tone?: 'sand' | 'ink';
  children?: ReactNode;
  testId?: string;
}

/**
 * A home-screen widget (Fitness-style): a rounded card with a title and a round chevron,
 * clickable as a whole. Cards holding their own buttons pass neither `to` nor `onClick`.
 */
export function Widget({ title, caption, to, onClick, size = 'half', tone = 'sand', children, testId }: WidgetProps) {
  const dark = tone === 'ink';
  const interactive = Boolean(to || onClick);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-[19px] font-bold leading-tight">{title}</h2>
          {caption && <p className={cx('mt-0.5 line-clamp-2 text-[15px] leading-snug', dark ? 'text-paper/70' : 'text-muted')}>{caption}</p>}
        </div>
        {interactive && (
          <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-full', dark ? 'bg-paper/15' : 'bg-paper')} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
      {children && <div className="mt-3 flex min-h-0 flex-1 flex-col">{children}</div>}
    </>
  );
  const className = cx(
    'flex min-h-40 flex-col rounded-[26px] p-4 text-left sm:p-5',
    size === 'full' ? 'col-span-2' : 'col-span-1',
    dark ? 'bg-ink text-paper' : 'bg-sand text-ink',
    interactive && 'transition-transform duration-150 active:scale-[0.98]',
    interactive && (dark ? 'hover:bg-ink-soft' : 'hover:bg-sand-deep'),
  );
  if (to) {
    return (
      <Link to={to} className={className} data-testid={testId}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} data-testid={testId}>
        {body}
      </button>
    );
  }
  return (
    <section className={className} data-testid={testId}>
      {body}
    </section>
  );
}

/** A big number with its unit, the main figure of a widget. */
export function WidgetFigure({ value, unit, accent }: { value: ReactNode; unit?: ReactNode; accent?: boolean }) {
  return (
    <p className="mt-auto flex items-baseline gap-1.5">
      <span className={cx('font-display text-[40px] font-extrabold leading-none tracking-tight', accent && 'text-lime-text')}>{value}</span>
      {unit && <span className="text-[15px] font-semibold text-muted">{unit}</span>}
    </p>
  );
}
