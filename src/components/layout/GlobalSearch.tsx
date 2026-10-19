import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search, Wrench } from 'lucide-react';
import { CATEGORIES, SPECIALIZATIONS } from '@/domain/catalog';
import { inferSpecializations, searchMechanics } from '@/domain/logic/search';
import { normalize } from '@/domain/utils';
import { useApp } from '@/state/store';
import { CATEGORY_ICONS } from '@/pages/owner/HomePage';
import { buildSearchParams } from '@/pages/owner/searchParams';
import { Avatar, Dialog, Input } from '@/components/ui';

/**
 * Quick search from the header. It searches what the demo data actually has: mechanics,
 * services, and specialities (also reached through common problem words, e.g. "chirría"
 * → frenos). "Ver todos" hands the query to the Mecánicos screen to explore and compare.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const [query, setQuery] = useState('');
  const q = normalize(query.trim());

  const results = useMemo(() => {
    if (q.length < 2) return null;
    const specs = new Set(inferSpecializations(query));
    SPECIALIZATIONS.forEach((s) => normalize(s.label).includes(q) && specs.add(s.id));
    return {
      services: CATEGORIES.filter((c) => normalize(`${c.label} ${c.short}`).includes(q)),
      specializations: SPECIALIZATIONS.filter((s) => specs.has(s.id)),
      mechanics: searchMechanics(mechanics, reviews, { query }).slice(0, 5),
    };
  }, [q, query, mechanics, reviews]);

  const go = (to: string) => {
    onClose();
    setQuery('');
    navigate(to);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) go(`/mecanicos?${buildSearchParams({ query: query.trim() })}`);
  };
  const empty = results && !results.services.length && !results.specializations.length && !results.mechanics.length;

  const row = 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-sand';
  return (
    <Dialog open={open} onClose={onClose} title="Buscar" sheet>
      <form onSubmit={submit} role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mecánico, servicio o problema: frenos, cambios…"
            aria-label="Buscar en Cromiqa"
            className="pl-12"
            enterKeyHint="search"
          />
        </div>
      </form>

      <div className="mt-4 min-h-40" aria-live="polite">
        {!results && <p className="px-1 text-sm text-muted">Escribe al menos dos letras.</p>}
        {empty && <p className="px-1 text-sm text-muted">No hay resultados para “{query.trim()}”.</p>}
        {results && !empty && (
          <div className="space-y-4">
            {(results.services.length > 0 || results.specializations.length > 0) && (
              <section>
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Servicios y especialidades</h3>
                <ul className="mt-1">
                  {results.services.map((c) => {
                    const Icon = CATEGORY_ICONS[c.id];
                    return (
                      <li key={c.id}>
                        <button type="button" className={row} onClick={() => go(`/mecanicos?${buildSearchParams({ category: c.id })}`)}>
                          <Icon className="size-5 shrink-0 text-muted" aria-hidden />
                          <span className="flex-1 text-[15px]">{c.label}</span>
                          <ChevronRight className="size-4 text-muted" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                  {results.specializations.map((s) => (
                    <li key={s.id}>
                      <button type="button" className={row} onClick={() => go(`/mecanicos?${buildSearchParams({ specialization: s.id })}`)}>
                        <Wrench className="size-5 shrink-0 text-muted" aria-hidden />
                        <span className="flex-1 text-[15px]">{s.label}</span>
                        <ChevronRight className="size-4 text-muted" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.mechanics.length > 0 && (
              <section>
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Mecánicos</h3>
                <ul className="mt-1">
                  {results.mechanics.map(({ mechanic: m }) => (
                    <li key={m.id}>
                      <button type="button" className={row} onClick={() => go(`/mecanicos/${m.id}`)}>
                        <Avatar name={m.name} tone={m.avatarTone} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold">{m.name}</span>
                          <span className="block truncate text-xs text-muted">{m.headline}</span>
                        </span>
                        <ChevronRight className="size-4 text-muted" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => go(`/mecanicos?${buildSearchParams({ query: query.trim() })}`)} className="mt-2 px-3 text-sm font-semibold hover:underline">
                  Ver todos en Mecánicos
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
