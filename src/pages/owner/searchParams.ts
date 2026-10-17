import type { BikeType, LocationId, ServiceCategory, ServiceMode, Specialization } from '@/domain/types';
import type { MechanicFilters, SortKey } from '@/domain/logic/search';
import { BIKE_TYPES, CATEGORIES, LOCATIONS, SPECIALIZATIONS } from '@/domain/catalog';

// Spanish, shareable URL params for the mechanic search.
const KEYS = {
  query: 'q',
  category: 'servicio',
  location: 'zona',
  bikeType: 'bici',
  mode: 'modalidad',
  specialization: 'especialidad',
  sort: 'orden',
} as const;

const MODE_PARAM: Record<ServiceMode, string> = { home: 'domicilio', workshop: 'taller' };

export function buildSearchParams(f: MechanicFilters & { fromHome?: boolean }) {
  const p = new URLSearchParams();
  if (f.query) p.set(KEYS.query, f.query);
  if (f.category) p.set(KEYS.category, f.category);
  if (f.location) p.set(KEYS.location, f.location);
  if (f.bikeType) p.set(KEYS.bikeType, f.bikeType);
  if (f.mode) p.set(KEYS.mode, MODE_PARAM[f.mode]);
  if (f.specialization) p.set(KEYS.specialization, f.specialization);
  if (f.sort && f.sort !== 'relevance') p.set(KEYS.sort, f.sort);
  if (f.fromHome) p.set('desde', 'inicio');
  return p.toString();
}

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

export function parseSearchParams(p: URLSearchParams): MechanicFilters & { fromHome: boolean } {
  const modeRaw = p.get(KEYS.mode);
  return {
    query: p.get(KEYS.query) ?? undefined,
    category: oneOf<ServiceCategory>(p.get(KEYS.category), CATEGORIES.map((c) => c.id)),
    location: oneOf<LocationId>(p.get(KEYS.location), LOCATIONS.map((l) => l.id)),
    bikeType: oneOf<BikeType>(p.get(KEYS.bikeType), BIKE_TYPES.map((b) => b.id)),
    mode: modeRaw === 'domicilio' ? 'home' : modeRaw === 'taller' ? 'workshop' : undefined,
    specialization: oneOf<Specialization>(p.get(KEYS.specialization), SPECIALIZATIONS.map((s) => s.id)),
    sort: oneOf<SortKey>(p.get(KEYS.sort), ['relevance', 'price', 'distance', 'rating']) ?? 'relevance',
    fromHome: p.get('desde') === 'inicio',
  };
}
