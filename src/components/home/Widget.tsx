import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cx } from '@/components/ui';

/**
 * A Home widget: a white card with its title top-left and an arrow top-right that opens the
 * full view. Small widgets take one column of the grid; wide ones take the full row on phones
 * and half of it on large screens.
 *
 * With `to`, the whole card is the link. With `linkHeader`, only the title row is (for widgets
 * that contain their own links).
 */
export function Widget({
  title,
  to,
  linkHeader,
  wide,
  testId,
  className,
  children,
}: {
  title: string;
  to?: string;
  linkHeader?: boolean;
  wide?: boolean;
  testId?: string;
  className?: string;
  children: ReactNode;
}) {
  const header = (
    <span className="flex items-start justify-between gap-3">
      <span className="font-display text-[17px] font-semibold leading-tight tracking-tight">{title}</span>
      {to && <ArrowUpRight className="size-[18px] shrink-0 text-muted" aria-hidden />}
    </span>
  );
  const classes = cx('surface flex flex-col rounded-[22px] p-4 sm:p-5', wide ? 'col-span-2' : 'col-span-1', className);
  if (to && !linkHeader) {
    return (
      <Link to={to} className={classes} data-testid={testId}>
        {header}
        {children}
      </Link>
    );
  }
  return (
    <section className={classes} data-testid={testId} aria-label={title}>
      {to ? (
        <Link to={to} className="-m-1 rounded-xl p-1 hover:opacity-80">
          {header}
        </Link>
      ) : (
        header
      )}
      {children}
    </section>
  );
}

/** A big figure with its caption, the body of a small widget. */
export function Stat({ value, caption, accent, small }: { value: ReactNode; caption: ReactNode; accent?: boolean; small?: boolean }) {
  return (
    <span className="mt-auto block pt-5">
      <span className={cx('flex items-center gap-2 font-display font-bold leading-none tracking-tight', small ? 'text-[30px]' : 'text-[40px]')}>
        {value}
        {accent && <span className="size-2.5 rounded-full bg-lime ring-2 ring-ink" aria-hidden />}
      </span>
      <span className="mt-2 block text-[15px] leading-snug text-muted">{caption}</span>
    </span>
  );
}

/** An icon tile next to a title and subtitle, the body of a wide widget. */
export function Feature({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: ReactNode; subtitle: ReactNode }) {
  return (
    <span className="mt-4 flex items-center gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-canvas" aria-hidden>
        <Icon className="size-6 text-lime-text" />
      </span>
      <span className="min-w-0">
        <span className="block text-[19px] font-semibold leading-tight">{title}</span>
        <span className="mt-1 block text-[15px] text-muted">{subtitle}</span>
      </span>
    </span>
  );
}

/** The dark lead card at the top of each Home: label, a short headline and one primary action. */
export function HeroWidget({
  label,
  icon: Icon,
  headline,
  action,
  testId,
}: {
  label: string;
  icon: LucideIcon;
  headline: ReactNode;
  action: ReactNode;
  testId?: string;
}) {
  return (
    <section className="col-span-2 flex flex-col rounded-[26px] bg-ink p-5 text-paper shadow-[var(--shadow-surface)] sm:p-6" data-testid={testId} aria-labelledby={testId ? `${testId}-label` : undefined}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={testId ? `${testId}-label` : undefined} className="text-[17px] font-semibold text-paper/90">
          {label}
        </h2>
        <Icon className="size-5 shrink-0 text-lime" aria-hidden />
      </div>
      <p className="mt-4 font-display text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[32px]">{headline}</p>
      <div className="mt-6">{action}</div>
    </section>
  );
}

export const heroButtonClass =
  'flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lime px-6 text-[17px] font-semibold text-ink transition-colors hover:bg-lime-deep active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime';

/** The grid the widgets sit in: two columns on phones, four on large screens. */
export function WidgetGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}
