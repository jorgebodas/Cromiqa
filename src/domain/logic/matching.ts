// Which providers can take a request and in what order to suggest them. The weights are an
// initial hypothesis, not a validated algorithm: keep them configurable and the result
// explainable. Nothing here claims availability slots or a "match percentage".
import type { BikeType, LocationId, Mechanic, Review, ServiceCategory, ServiceMode } from '../types';
import { approxDistanceKm, bikeTypeLabel, locationShort, specializationLabel } from '../catalog';
import { inferSpecializations, ratingFor } from './search';

export interface MatchCriteria {
  category: ServiceCategory;
  bikeType?: BikeType;
  mode: ServiceMode;
  location: LocationId;
  /** Free-text problem; only used to boost specialists. */
  description?: string;
  /** The account's own workshop is never suggested. */
  excludeMechanicId?: string;
}

/** Initial ranking hypothesis (sums to 1). Tune, don't treat as truth. */
export const MATCH_WEIGHTS = { proximity: 0.35, specialization: 0.3, availability: 0.2, trust: 0.15 } as const;

export interface Match {
  mechanic: Mechanic;
  score: number;
  /** Short, factual reasons shown to the cyclist. */
  reasons: string[];
  distanceKm: number;
}

/** Capability check: the provider offers the service, the bike, the modality and the area. */
export function canTake(m: Mechanic, c: MatchCriteria): boolean {
  if (m.id === c.excludeMechanicId) return false;
  if (!m.services.some((s) => s.category === c.category)) return false;
  if (c.bikeType && !m.bikeTypes.includes(c.bikeType)) return false;
  if (c.mode === 'home') return m.homeService && m.serviceAreas.includes(c.location);
  return m.workshop;
}

/**
 * Compatible providers, best first. Proximity means travel to the workshop for workshop
 * jobs, and being inside the provider's area (with travel conditions) for home service.
 */
export function matchProviders(mechanics: Mechanic[], reviews: Review[], c: MatchCriteria, weights = MATCH_WEIGHTS): Match[] {
  const wanted = c.description ? inferSpecializations(c.description) : [];
  return mechanics
    .filter((m) => canTake(m, c))
    .map((m) => {
      const distanceKm = approxDistanceKm(m.baseLocation, c.location);
      const proximity = c.mode === 'home' ? (m.baseLocation === c.location ? 1 : 0.8) : Math.max(0, 1 - distanceKm / 25);
      const specialistFor = wanted.filter((s) => m.specializations.includes(s));
      const bikeFirst = c.bikeType && m.bikeTypes[0] === c.bikeType;
      const specialization = Math.min(1, specialistFor.length * 0.6 + (bikeFirst ? 0.4 : 0.15));
      const availability = m.weeklyAvailability.length ? Math.min(1, m.weeklyAvailability.length / 5) : 0;
      const { reviewCount } = ratingFor(m.id, reviews);
      // Verified work counts, but no single review dominates.
      const trust = (m.demoVerified ? 0.5 : 0) + Math.min(reviewCount, 10) / 20;
      const score =
        weights.proximity * proximity + weights.specialization * specialization + weights.availability * availability + weights.trust * trust;

      const reasons: string[] = [];
      if (c.mode === 'home') reasons.push(`Va a domicilio en ${locationShort(c.location)}`);
      else reasons.push(distanceKm <= 3 ? `Taller en ${locationShort(m.baseLocation)}` : `Taller a unos ${Math.round(distanceKm)} km`);
      if (specialistFor[0]) reasons.push(`Especialista en ${specializationLabel(specialistFor[0]).toLowerCase()}`);
      else if (bikeFirst && c.bikeType) reasons.push(`Especialista en ${bikeTypeLabel(c.bikeType).toLowerCase()}`);
      return { mechanic: m, score, reasons, distanceKm };
    })
    .sort((a, b) => b.score - a.score);
}

/** How many providers are highlighted as recommended. */
export const RECOMMENDED_COUNT = 3;
