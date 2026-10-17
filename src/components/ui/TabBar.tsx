import { cx } from './cx';

/** Horizontal, scrollable filter tabs with counts. */
export function TabBar<T extends string>({ tabs, value, onChange, counts }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; counts: Record<T, number> }) {
  return (
    <div role="tablist" aria-label="Filtrar solicitudes" className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
            value === t.id ? 'border-ink bg-ink text-paper' : 'border-line-strong hover:border-ink',
          )}
        >
          {t.label}
          <span className={cx('text-xs', value === t.id ? 'text-paper/70' : 'text-muted')}>{counts[t.id]}</span>
        </button>
      ))}
    </div>
  );
}
