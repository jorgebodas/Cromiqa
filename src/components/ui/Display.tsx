import type { HTMLAttributes, ReactNode } from 'react';
import { FlaskConical, Star } from 'lucide-react';
import { cx } from './cx';
import { initials } from '@/domain/utils';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ink' | 'lime' | 'outline' | 'danger';
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'bg-sand text-ink',
    ink: 'bg-ink text-paper',
    lime: 'bg-lime text-ink',
    outline: 'border border-line-strong text-ink bg-paper',
    danger: 'bg-danger-soft text-danger',
  } as const;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Marks fictional content (ratings, verification) so it is never mistaken for real data. */
export function DemoTag({ children = 'Demo', className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border border-dashed border-line-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted',
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      {children}
    </span>
  );
}

export function Avatar({ name, tone = '#E4E1D8', size = 'md', className }: { name: string; tone?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-12 text-sm', lg: 'size-16 text-lg', xl: 'size-24 text-2xl' } as const;
  return (
    <span
      className={cx('inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold text-ink', sizes[size], className)}
      style={{ backgroundColor: tone }}
      role="img"
      aria-label={`Avatar ilustrativo de ${name}`}
    >
      {initials(name)}
    </span>
  );
}

export function Rating({ rating, count, compact }: { rating: number; count: number; compact?: boolean }) {
  if (count === 0) return <span className="text-sm text-muted">Sin valoraciones</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Star className="size-4 fill-ink text-ink" aria-hidden />
      <span className="font-semibold">{rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })}</span>
      <span className="text-muted">
        ({count}
        {compact ? '' : count === 1 ? ' reseña' : ' reseñas'})
      </span>
      <DemoTag />
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5 estrellas`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cx('size-3.5', i <= value ? 'fill-ink text-ink' : 'text-line-strong')} aria-hidden />
      ))}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  as: Heading = 'h3',
}: {
  icon: ReactNode;
  title: string;
  /** Use 'h1' when the empty state is the whole page. */
  as?: 'h1' | 'h2' | 'h3';
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('surface flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-sand text-ink" aria-hidden>
        {icon}
      </span>
      <Heading className="text-lg font-bold">{title}</Heading>
      {description && <p className="mt-1.5 max-w-sm text-[15px] text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-bold">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-[15px] text-ink">{children}</dd>
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
