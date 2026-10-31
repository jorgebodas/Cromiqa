import { describe, expect, it } from 'vitest';
import { createSeed } from '@/data/seed';
import { availableModes } from './modes';
import { searchMechanics } from './search';
import { matchProviders } from './matching';
import { validateForMechanic } from './requests';
import { profileStatus } from './home';
import { ONBOARDING_STEPS, approveProfessionalProfile, emptyProfessionalDraft, isListed, submitProfessionalProfile, validateOnboardingStep, type ProfessionalDraft } from './onboarding';

const now = new Date('2026-10-17T10:00:00');
const draft = (): ProfessionalDraft => ({
  ...emptyProfessionalDraft('madrid-vallecas'),
  businessName: 'Taller Serrano',
  headline: 'Carretera y gravel',
  bio: 'Diez años montando y ajustando bicis de carretera en Vallecas.',
  yearsExperience: 10,
  specializations: ['road'],
  bikeTypes: ['road', 'gravel'],
  workshopArea: 'Vallecas Villa',
  services: [{ category: 'maintenance', priceFrom: 40 }],
});

describe('professional onboarding', () => {
  it('validates each step and everything on the last one', () => {
    const empty = emptyProfessionalDraft('rivas');
    expect(Object.keys(validateOnboardingStep(0, empty))).toEqual(expect.arrayContaining(['businessName', 'headline', 'bio']));
    expect(Object.keys(validateOnboardingStep(1, empty))).toEqual(['specializations', 'bikeTypes']);
    expect(validateOnboardingStep(2, { ...empty, workshop: false, homeService: false }).mode).toBeDefined();
    expect(validateOnboardingStep(2, { ...empty, workshop: false, homeService: true }).serviceAreas).toBeDefined();
    expect(validateOnboardingStep(3, empty).services).toBeDefined();
    expect(Object.keys(validateOnboardingStep(ONBOARDING_STEPS.length - 1, draft()))).toHaveLength(0);
  });

  it('creates a profile pending verification that gives the account mechanic mode, unlisted', () => {
    const db = createSeed(now);
    const { db: next, mechanic } = submitProfessionalProfile(db, 'u-pablo', draft());
    const pablo = next.users.find((u) => u.id === 'u-pablo')!;
    expect(pablo.mechanicId).toBe(mechanic.id);
    expect(availableModes(pablo)).toContain('mechanic');
    expect(mechanic.listing).toBe('pending_verification');
    expect(profileStatus(mechanic)).toBe('pending_verification');
    // Not searchable, not suggested, can't receive requests.
    expect(searchMechanics(next.mechanics, next.reviews, {}).some((r) => r.mechanic.id === mechanic.id)).toBe(false);
    expect(matchProviders(next.mechanics, next.reviews, { category: 'maintenance', bikeType: 'road', mode: 'workshop', location: 'madrid-vallecas' }).some((m) => m.mechanic.id === mechanic.id)).toBe(false);
    expect(validateForMechanic({ ownerId: 'u-ana', category: 'maintenance', bike: { type: 'road', brand: 'x', model: 'y' }, mode: 'workshop', location: 'madrid-vallecas' }, mechanic.id, next).mechanicId).toMatch(/aún no está activo/);
    expect(() => submitProfessionalProfile(next, 'u-pablo', draft())).toThrow(/ya tiene/);
  });

  it('once approved (demo), the profile is listed and can be matched', () => {
    const created = submitProfessionalProfile(createSeed(now), 'u-pablo', draft());
    const { db, mechanic } = approveProfessionalProfile(created.db, created.mechanic.id);
    expect(isListed(mechanic)).toBe(true);
    expect(profileStatus(mechanic)).toBe('active');
    expect(searchMechanics(db.mechanics, db.reviews, {}).some((r) => r.mechanic.id === mechanic.id)).toBe(true);
    expect(() => approveProfessionalProfile(db, mechanic.id)).toThrow();
  });
});
