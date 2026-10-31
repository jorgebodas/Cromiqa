import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, Pencil, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import type { MechanicFilters, SortKey } from '@/domain/logic/search';
import { searchMechanics } from '@/domain/logic/search';
import { BIKE_TYPES, CATEGORIES, LOCATIONS, SPECIALIZATIONS, categoryLabel } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useNavUi } from '@/state/ui';
import { MechanicCard } from '@/components/domain/MechanicCard';
import { Button, Dialog, EmptyState, Field, Input, Select, cx } from '@/components/ui';
import { buildSearchParams, parseSearchParams } from './searchParams';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions, ProfileButton } from '@/components/layout/QuickActions';

function FilterControls({ filters, set }: { filters: MechanicFilters; set: (patch: Partial<MechanicFilters>) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Servicio">
        <Select value={filters.category ?? ''} onChange={(e) => set({ category: (e.target.value || undefined) as MechanicFilters['category'] })} name="filter-category">
          <option value="">Todos los servicios</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Zona">
        <Select value={filters.location ?? ''} onChange={(e) => set({ location: (e.target.value || undefined) as MechanicFilters['location'] })} name="filter-location">
          <option value="">Todas las zonas</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tipo de bici">
        <Select value={filters.bikeType ?? ''} onChange={(e) => set({ bikeType: (e.target.value || undefined) as MechanicFilters['bikeType'] })} name="filter-bike">
          <option value="">Cualquiera</option>
          {BIKE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Modalidad</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
          {([
            [undefined, 'Todas'],
            ['home', 'Domicilio'],
            ['workshop', 'Taller'],
          ] as const).map(([value, label]) => (
            <label
              key={label}
              className={cx(
                'flex h-9 cursor-pointer items-center justify-center rounded-xl text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
                filters.mode === value ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              <input type="radio" className="sr-only" name="filter-mode" checked={filters.mode === value} onChange={() => set({ mode: value })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Especialidad">
        <Select
          value={filters.specialization ?? ''}
          onChange={(e) => set({ specialization: (e.target.value || undefined) as MechanicFilters['specialization'] })}
          name="filter-specialization"
        >
          <option value="">Todas</option>
          {SPECIALIZATIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function ActiveChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink pl-3 pr-2 text-xs font-medium text-paper hover:bg-ink-soft"
      aria-label={`Quitar filtro: ${children}`}
    >
      {children}
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

export function FindMechanicPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseSearchParams(params), [params]);
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const draft = useApp((s) => s.draft);
  const [query, setQuery] = useState(filters.query ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const openNewRequest = useNavUi((s) => s.openNewRequest);

  const showProblem = filters.fromHome && draft.category;
  const results = useMemo(
    () => searchMechanics(mechanics, reviews, { ...filters, problem: showProblem ? draft.description : undefined }),
    [mechanics, reviews, filters, showProblem, draft.description],
  );

  // Always merge into the latest filters, so the debounced text search can
  // never overwrite a filter chosen in the meantime.
  const latest = useRef(filters);
  latest.current = filters;
  const update = (patch: Partial<MechanicFilters>) => {
    const next = { ...latest.current, ...patch };
    if (!next.location && next.sort === 'distance') next.sort = 'relevance';
    latest.current = next;
    setParams(buildSearchParams(next), { replace: true });
  };

  // Debounced free-text search.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((filters.query ?? '') !== query.trim()) update({ query: query.trim() || undefined });
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = [filters.category, filters.location, filters.bikeType, filters.mode, filters.specialization].filter(Boolean).length;
  const clearAll = () => {
    setQuery('');
    setParams(filters.fromHome ? 'desde=inicio' : '', { replace: true });
  };
  const requestHref = (id: string) =>
    `/solicitar?${buildSearchParams({ category: filters.category, location: filters.location, mode: filters.mode, bikeType: filters.bikeType })}&mecanico=${id}`;

  const label = (list: { id: string; label: string }[], id?: string) => list.find((x) => x.id === id)?.label;

  return (
    <>
      {/* This screen has its own search field, so the header leaves the search button out. */}
      <ScreenHeader title="Mecánicos" leading={<ProfileButton />} actions={<CyclistHeaderActions search={false} />} />
      <div className="container-page pb-8 sm:pb-10">

      {showProblem && (
        <div className="mb-6 flex flex-col gap-3 surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">Tu necesidad: {categoryLabel(draft.category!)}</span>
            {draft.description && <span className="text-muted"> · “{draft.description.length > 90 ? `${draft.description.slice(0, 90)}…` : draft.description}”</span>}
          </p>
          <button type="button" onClick={openNewRequest} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
            <Pencil className="size-3.5" aria-hidden /> Cambiar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros">
          <div className="sticky top-24 space-y-5">
            <FilterControls filters={filters} set={update} />
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Borrar filtros
              </Button>
            )}
          </div>
        </aside>

        <section aria-labelledby="results-title" className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca: suspensión, frenos, e-bike, Brompton…"
                aria-label="Buscar por especialidad, servicio o nombre"
                className="pl-12"
                name="q"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-12 flex-1 lg:hidden" onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal className="size-4" aria-hidden />}>
                Filtros{activeCount ? ` (${activeCount})` : ''}
              </Button>
              <label className="sr-only" htmlFor="sort">
                Ordenar por
              </label>
              <Select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })} className="h-12 min-w-44">
                <option value="relevance">Más relevantes</option>
                <option value="price">Precio más bajo</option>
                <option value="distance" disabled={!filters.location}>
                  Más cercanos{filters.location ? '' : ' (elige zona)'}
                </option>
                <option value="rating">Mejor valorados</option>
              </Select>
            </div>
          </div>

          {(activeCount > 0 || filters.query) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.query && <ActiveChip onRemove={() => { setQuery(''); update({ query: undefined }); }}>“{filters.query}”</ActiveChip>}
              {filters.category && <ActiveChip onRemove={() => update({ category: undefined })}>{label(CATEGORIES, filters.category)}</ActiveChip>}
              {filters.location && <ActiveChip onRemove={() => update({ location: undefined })}>{label(LOCATIONS, filters.location)}</ActiveChip>}
              {filters.bikeType && <ActiveChip onRemove={() => update({ bikeType: undefined })}>{label(BIKE_TYPES, filters.bikeType)}</ActiveChip>}
              {filters.mode && <ActiveChip onRemove={() => update({ mode: undefined })}>{filters.mode === 'home' ? 'A domicilio' : 'En taller'}</ActiveChip>}
              {filters.specialization && <ActiveChip onRemove={() => update({ specialization: undefined })}>{label(SPECIALIZATIONS, filters.specialization)}</ActiveChip>}
            </div>
          )}

          <div className="mb-4 mt-6 flex items-center justify-between">
            <h2 id="results-title" className="text-sm font-medium text-muted" aria-live="polite" data-testid="results-count">
              {results.length === 1 ? '1 mecánico' : `${results.length} mecánicos`}
            </h2>
            {filters.location && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Info className="size-3.5" aria-hidden />
                Distancias aproximadas entre zonas, no tu ubicación.
              </p>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="Ningún mecánico encaja con estos filtros"
              description="Prueba a quitar algún filtro o a cambiar de zona. En la demo hay seis mecánicos en el sureste de Madrid."
              action={<Button variant="dark" onClick={clearAll}>Borrar filtros</Button>}
            />
          ) : (
            <ul className="space-y-4">
              {results.map((r) => (
                <li key={r.mechanic.id}>
                  <MechanicCard result={r} requestHref={requestHref(r.mechanic.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={clearAll}>
              Borrar filtros
            </Button>
            <Button variant="dark" onClick={() => setFiltersOpen(false)}>
              Ver {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            </Button>
          </>
        }
      >
        <FilterControls filters={filters} set={update} />
      </Dialog>
      </div>
    </>
  );
}
