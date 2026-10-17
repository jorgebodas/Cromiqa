// Mechanic search: deterministic filtering, scoring and sorting over demo data.
import type { BikeType, LocationId, Mechanic, Review, ServiceCategory, ServiceMode, Specialization } from '../types';
import { SPECIALIZATIONS, approxDistanceKm } from '../catalog';
import { normalize, tokenize } from '../utils';

export type SortKey = 'relevance' | 'price' | 'distance' | 'rating';

export interface MechanicFilters {
  query?: string;
  /** Free-text problem from the home screen: boosts relevance, never filters. */
  problem?: string;
  category?: ServiceCategory;
  location?: LocationId;
  bikeType?: BikeType;
  mode?: ServiceMode;
  specialization?: Specialization;
  sort?: SortKey;
}

export interface MechanicResult {
  mechanic: Mechanic;
  score: number;
  rating: number;
  reviewCount: number;
  /** Lowest indicative price for the selected category (or overall). */
  priceFrom?: number;
  /** Approx. km between area centres; only when a location is selected. */
  distanceKm?: number;
  coversLocation: boolean;
  matchedSpecializations: Specialization[];
}

/** Map free text to specializations via keywords ("los cambios saltan" -> transmission). */
export function inferSpecializations(text: string): Specialization[] {
  const tokens = new Set(tokenize(text));
  const norm = normalize(text);
  return SPECIALIZATIONS.filter((s) => s.keywords.some((k) => tokens.has(k) || (k.includes(' ') && norm.includes(k)))).map(
    (s) => s.id,
  );
}

export function ratingFor(mechanicId: string, reviews: Review[]) {
  const mine = reviews.filter((r) => r.mechanicId === mechanicId);
  const avg = mine.length ? mine.reduce((a, r) => a + r.rating, 0) / mine.length : 0;
  return { rating: Math.round(avg * 10) / 10, reviewCount: mine.length };
}

function searchableText(m: Mechanic) {
  return normalize(
    [
      m.name,
      m.businessName,
      m.headline,
      m.bio,
      ...m.services.map((s) => `${s.name} ${s.description}`),
      ...m.specializations.map((s) => SPECIALIZATIONS.find((x) => x.id === s)?.keywords.join(' ') ?? ''),
    ].join(' '),
  );
}

export function servesLocation(m: Mechanic, location: LocationId, mode?: ServiceMode) {
  const home = m.homeService && m.serviceAreas.includes(location);
  const shop = m.workshop && m.baseLocation === location;
  if (mode === 'home') return home;
  if (mode === 'workshop') return m.workshop && (shop || approxDistanceKm(m.baseLocation, location) <= 15);
  return home || shop || (m.workshop && approxDistanceKm(m.baseLocation, location) <= 15);
}

export function searchMechanics(mechanics: Mechanic[], reviews: Review[], f: MechanicFilters): MechanicResult[] {
  const queryTokens = f.query ? tokenize(f.query) : [];
  const querySpecs = f.query ? inferSpecializations(f.query) : [];
  const problemSpecs = f.problem ? inferSpecializations(f.problem) : [];

  const results: MechanicResult[] = [];
  for (const m of mechanics) {
    if (f.mode === 'home' && !m.homeService) continue;
    if (f.mode === 'workshop' && !m.workshop) continue;
    if (f.bikeType && !m.bikeTypes.includes(f.bikeType)) continue;
    if (f.specialization && !m.specializations.includes(f.specialization)) continue;
    if (f.category && !m.services.some((s) => s.category === f.category)) continue;
    if (f.location && !servesLocation(m, f.location, f.mode)) continue;

    const text = searchableText(m);
    if (queryTokens.length) {
      const hit =
        querySpecs.some((s) => m.specializations.includes(s)) || queryTokens.some((t) => text.includes(t));
      if (!hit) continue;
    }

    const { rating, reviewCount } = ratingFor(m.id, reviews);
    const relevantServices = f.category ? m.services.filter((s) => s.category === f.category) : m.services;
    const prices = relevantServices.map((s) => s.priceFrom).filter((p): p is number => typeof p === 'number');
    const priceFrom = prices.length ? Math.min(...prices) : undefined;
    const distanceKm = f.location ? approxDistanceKm(m.baseLocation, f.location) : undefined;
    const coversLocation = f.location ? m.serviceAreas.includes(f.location) || m.baseLocation === f.location : true;
    const matchedSpecializations = [...new Set([...querySpecs, ...problemSpecs])].filter((s) =>
      m.specializations.includes(s),
    );

    let score = rating * 2 + Math.min(reviewCount, 20) * 0.1;
    score += matchedSpecializations.length * 6;
    if (f.specialization && m.specializations[0] === f.specialization) score += 3;
    if (f.location) score += coversLocation ? 4 : 0;
    if (f.location && m.baseLocation === f.location) score += 2;
    if (f.bikeType && m.bikeTypes[0] === f.bikeType) score += 2;
    if (m.demoVerified) score += 0.5;

    results.push({ mechanic: m, score, rating, reviewCount, priceFrom, distanceKm, coversLocation, matchedSpecializations });
  }

  const sort = f.sort ?? 'relevance';
  const by: Record<SortKey, (a: MechanicResult, b: MechanicResult) => number> = {
    relevance: (a, b) => b.score - a.score,
    price: (a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity) || b.score - a.score,
    distance: (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || b.score - a.score,
    rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
  };
  return results.sort(by[sort]);
}
