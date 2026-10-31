// Professional onboarding: a cyclist account creates its professional profile. The draft
// lives with the person until they submit it; then it waits for verification, and only an
// active profile is listed, searchable and can receive requests.
import type { BikeType, DemoDatabase, ID, LocationId, Mechanic, MechanicService, ServiceCategory, Specialization, TimeSlot, Weekday } from '../types';
import { categoryLabel } from '../catalog';
import { DomainError } from './requests';
import { uid } from '../utils';

export interface ProfessionalDraft {
  businessName: string;
  headline: string;
  bio: string;
  yearsExperience: number;
  specializations: Specialization[];
  bikeTypes: BikeType[];
  baseLocation: LocationId;
  workshop: boolean;
  workshopArea: string;
  homeService: boolean;
  serviceAreas: LocationId[];
  homeServiceFee?: number;
  days: Weekday[];
  slots: TimeSlot[];
  /** Services offered, with an optional starting price (undefined = "a consultar"). */
  services: { category: ServiceCategory; priceFrom?: number }[];
  /** Conditions the cyclist should know: payment, guarantee, what's included. */
  conditions: string;
}

export const emptyProfessionalDraft = (base: LocationId): ProfessionalDraft => ({
  businessName: '',
  headline: '',
  bio: '',
  yearsExperience: 0,
  specializations: [],
  bikeTypes: [],
  baseLocation: base,
  workshop: true,
  workshopArea: '',
  homeService: false,
  serviceAreas: [],
  days: [0, 1, 2, 3, 4],
  slots: ['morning', 'afternoon'],
  services: [],
  conditions: '',
});

export const ONBOARDING_STEPS = ['Identidad', 'Especialidades', 'Modalidad y zona', 'Servicios y condiciones', 'Revisión'] as const;

/** Errors for one onboarding step (0-based). The last step validates everything. */
export function validateOnboardingStep(step: number, d: ProfessionalDraft): Record<string, string> {
  const e: Record<string, string> = {};
  const all = step >= ONBOARDING_STEPS.length - 1;
  if (step === 0 || all) {
    if (d.businessName.trim().length < 2) e.businessName = 'Indica tu nombre profesional o el de tu taller.';
    if (d.headline.trim().length < 5) e.headline = 'Describe tu especialidad en una línea.';
    if (d.bio.trim().length < 30) e.bio = 'Cuéntales a los ciclistas quién eres (al menos 30 caracteres).';
    if (!Number.isFinite(d.yearsExperience) || d.yearsExperience < 0 || d.yearsExperience > 60) e.yearsExperience = 'Años de experiencia no válidos.';
  }
  if (step === 1 || all) {
    if (d.specializations.length === 0) e.specializations = 'Elige al menos una especialidad.';
    if (d.bikeTypes.length === 0) e.bikeTypes = 'Elige al menos un tipo de bici.';
  }
  if (step === 2 || all) {
    if (!d.workshop && !d.homeService) e.mode = 'Ofrece al menos taller o servicio a domicilio.';
    if (d.workshop && d.workshopArea.trim().length < 3) e.workshopArea = 'Indica la zona del taller (sin dirección exacta).';
    if (d.homeService && d.serviceAreas.length === 0) e.serviceAreas = 'Elige al menos una zona a la que te desplazas.';
    if (d.homeServiceFee !== undefined && (!Number.isFinite(d.homeServiceFee) || d.homeServiceFee < 0)) e.homeServiceFee = 'El desplazamiento debe ser 0 € o más.';
    if (d.days.length === 0) e.days = 'Elige al menos un día de trabajo.';
    if (d.slots.length === 0) e.slots = 'Elige al menos una franja.';
  }
  if (step === 3 || all) {
    if (d.services.length === 0) e.services = 'Ofrece al menos un servicio.';
    if (d.services.some((s) => s.priceFrom !== undefined && (!Number.isFinite(s.priceFrom) || s.priceFrom < 0))) e.services = 'Revisa los precios: deben ser 0 € o más.';
  }
  return e;
}

export const isListed = (m: Pick<Mechanic, 'listing'>) => (m.listing ?? 'active') === 'active';

/**
 * Submits the onboarding: creates the professional profile in `pending_verification` and links
 * it to the account, which gets mechanic mode. Nothing is listed until it is verified.
 */
export function submitProfessionalProfile(db: DemoDatabase, userId: ID, d: ProfessionalDraft): { db: DemoDatabase; mechanic: Mechanic } {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new DomainError('Cuenta no encontrada.');
  if (user.mechanicId) throw new DomainError('Esta cuenta ya tiene un perfil profesional.');
  const first = Object.values(validateOnboardingStep(ONBOARDING_STEPS.length - 1, d))[0];
  if (first) throw new DomainError(first);
  const id = uid('m');
  const services: MechanicService[] = d.services.map((s) => ({
    id: uid('svc'),
    category: s.category,
    name: categoryLabel(s.category),
    description: '',
    priceFrom: s.priceFrom,
  }));
  const mechanic: Mechanic = {
    id,
    userId,
    name: user.name,
    businessName: d.businessName.trim(),
    headline: d.headline.trim(),
    bio: d.bio.trim(),
    yearsExperience: d.yearsExperience,
    avatarTone: '#e7e5df',
    baseLocation: d.baseLocation,
    workshopArea: d.workshop ? d.workshopArea.trim() : undefined,
    serviceAreas: d.homeService ? d.serviceAreas : [],
    homeService: d.homeService,
    workshop: d.workshop,
    homeServiceFee: d.homeService ? d.homeServiceFee : undefined,
    bikeTypes: d.bikeTypes,
    specializations: d.specializations,
    services,
    weeklyAvailability: d.days.map((day) => ({ day, slots: d.slots })),
    availabilityNote: d.conditions.trim(),
    responseTime: 'Responde en 24 h o menos',
    languages: ['Español'],
    demoVerified: false,
    listing: 'pending_verification',
    portfolio: [],
  };
  return {
    db: { ...db, mechanics: [...db.mechanics, mechanic], users: db.users.map((u) => (u.id === userId ? { ...u, mechanicId: id } : u)) },
    mechanic,
  };
}

/**
 * Demo only: stands in for Cromiqa's review of a submitted profile. A real backend would
 * restrict this to staff after checking identity and professional details.
 */
export function approveProfessionalProfile(db: DemoDatabase, mechanicId: ID): { db: DemoDatabase; mechanic: Mechanic } {
  const m = db.mechanics.find((x) => x.id === mechanicId);
  if (!m) throw new DomainError('Perfil no encontrado.');
  if (m.listing !== 'pending_verification') throw new DomainError('Este perfil no está pendiente de verificación.');
  const mechanic: Mechanic = { ...m, listing: 'active', demoVerified: true };
  return { db: { ...db, mechanics: db.mechanics.map((x) => (x.id === mechanicId ? mechanic : x)) }, mechanic };
}
