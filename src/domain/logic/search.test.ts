import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import { inferSpecializations, searchMechanics } from './search';

const db = createSeed(new Date('2026-10-17T10:00:00'));
const ids = (f: Parameters<typeof searchMechanics>[2]) => searchMechanics(db.mechanics, db.reviews, f).map((r) => r.mechanic.id);

describe('searchMechanics', () => {
  it('returns all mechanics without filters', () => {
    expect(ids({})).toHaveLength(db.mechanics.length);
  });

  it('finds suspension specialists offering home service (scenario D)', () => {
    const result = ids({ query: 'suspensión', mode: 'home' });
    expect(result).toEqual(expect.arrayContaining(['m-carlos', 'm-nerea', 'm-javi']));
    expect(result).not.toContain('m-andres');
    expect(result).not.toContain('m-marta');
  });

  it('filters by home service in a location (scenario A)', () => {
    const result = ids({ category: 'repair', location: 'rivas', mode: 'home', bikeType: 'mtb' });
    expect(result).toContain('m-carlos');
    expect(result).toContain('m-javi');
    expect(result).not.toContain('m-lucia');
  });

  it('only returns mechanics offering inspections (scenario E)', () => {
    const result = ids({ category: 'inspection' });
    for (const id of result) expect(db.mechanics.find((m) => m.id === id)!.services.some((s) => s.category === 'inspection')).toBe(true);
    expect(result).not.toContain('m-lucia');
  });

  it('sorts by price and approximate distance', () => {
    const byPrice = searchMechanics(db.mechanics, db.reviews, { category: 'repair', sort: 'price' });
    const prices = byPrice.map((r) => r.priceFrom ?? Infinity);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const byDistance = searchMechanics(db.mechanics, db.reviews, { location: 'coslada', sort: 'distance' });
    expect(byDistance[0]!.mechanic.id).toBe('m-lucia');
    const d = byDistance.map((r) => r.distanceKm!);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it('boosts relevance using the described problem', () => {
    expect(inferSpecializations('Los cambios saltan en subida')).toContain('transmission');
    const top = searchMechanics(db.mechanics, db.reviews, { problem: 'la horquilla pierde aceite', location: 'san-fernando' })[0]!;
    expect(top.matchedSpecializations).toContain('suspension');
  });
});
