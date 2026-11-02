import type { Bike, Mechanic, NewRequestInput, ID } from '@/domain/types';
import { bikeTypeLabel } from '@/domain/catalog';
import { MAX_PHOTOS } from '@/domain/logic/requests';
import type { RequestDraft } from '@/state/store';

export const STEP_TITLES = ['¿Qué le pasa?', 'Tu bici', 'Fotos', '¿Dónde?', '¿Cuándo?', 'Mecánicos', 'Revisión'] as const;
/** The heading of each step: says what to do there, always in one line (short labels above are for the progress bar). */
export const STEP_HEADINGS = ['¿Qué le pasa a tu bici?', 'Cuéntanos qué bici es', 'Fotos del problema', '¿Dónde te va mejor?', '¿Cuándo te viene bien?', 'Elige tus mecánicos', 'Revisa antes de enviar'] as const;
/** Step indexes, so screens don't hard-code positions. */
export const STEP = { need: 0, bike: 1, photos: 2, where: 3, when: 4, providers: 5, review: 6 } as const;
export const LAST_STEP = STEP_TITLES.length - 1;

export type DraftErrors = Partial<Record<
  'category' | 'description' | 'photos' | 'bikeId' | 'type' | 'brand' | 'model' | 'location' | 'mode' | 'timeSlots' | 'owner' | 'preferredDate' | 'askingPrice' | 'mechanicId',
  string
>>;

/**
 * Validates one step. `m` is the provider the request started from (mechanic-first), whose
 * capabilities narrow the choices; without it the steps are generic and compatibility is
 * checked when picking providers.
 */
export function validateStep(step: number, d: RequestDraft, m: Mechanic | undefined, ownerBikes: Bike[]): DraftErrors {
  const e: DraftErrors = {};
  if (step === 0) {
    if (!d.category) e.category = 'Elige el tipo de servicio.';
    else if (m && !m.services.some((s) => s.category === d.category)) e.category = `${m.name} no ofrece este tipo de servicio.`;
    if (d.description.trim().length < 10) e.description = 'Describe el problema con al menos 10 caracteres.';
  }
  if (step === 1) {
    const useGarage = d.category !== 'inspection' && d.bikeChoice === 'garage' && ownerBikes.length > 0;
    if (useGarage) {
      const bike = ownerBikes.find((b) => b.id === d.bikeId);
      if (!bike) e.bikeId = 'Elige una bici de tu garaje o añade otra.';
      else if (m && !m.bikeTypes.includes(bike.type)) e.bikeId = `${m.name} no trabaja con bicis de tipo ${bikeTypeLabel(bike.type).toLowerCase()}.`;
    } else {
      if (!d.bike.type) e.type = 'Elige el tipo de bici.';
      else if (m && !m.bikeTypes.includes(d.bike.type)) e.type = `${m.name} no trabaja con bicis de tipo ${bikeTypeLabel(d.bike.type).toLowerCase()}.`;
      if (d.inspection.askingPrice !== undefined && (d.inspection.askingPrice < 0 || d.inspection.askingPrice > 50000))
        e.askingPrice = 'Revisa el precio.';
    }
  }
  if (step === STEP.photos) {
    if (d.photos.length > MAX_PHOTOS) e.photos = `Puedes adjuntar ${MAX_PHOTOS} fotos como máximo.`;
  }
  if (step === STEP.where) {
    if (!d.location) e.location = 'Elige la zona.';
    if (!d.mode) e.mode = 'Elige domicilio o taller.';
    else if (m && d.mode === 'home' && !m.homeService) e.mode = `${m.name} no ofrece servicio a domicilio.`;
    else if (m && d.mode === 'workshop' && !m.workshop) e.mode = `${m.name} solo trabaja a domicilio.`;
    else if (m && d.mode === 'home' && d.location && !m.serviceAreas.includes(d.location))
      e.mode = `${m.name} no se desplaza a esa zona. Elige taller u otra zona.`;
  }
  if (step === STEP.when) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.availability.preferredDate && new Date(d.availability.preferredDate + 'T00:00:00') < today)
      e.preferredDate = 'La fecha no puede estar en el pasado.';
  }
  if (step === STEP.providers) {
    if (!d.mechanicId) e.mechanicId = 'Elige al menos un mecánico.';
  }
  return e;
}

export function firstInvalidStep(d: RequestDraft, m: Mechanic | undefined, bikes: Bike[]): number | null {
  for (let s = 0; s < LAST_STEP; s++) if (Object.keys(validateStep(s, d, m, bikes)).length) return s;
  return null;
}

/** The bike type the request is about, from the garage bike or the form. */
export function draftBikeType(d: RequestDraft, ownerBikes: Bike[]) {
  const useGarage = d.category !== 'inspection' && d.bikeChoice === 'garage' && ownerBikes.length > 0;
  return useGarage ? ownerBikes.find((b) => b.id === d.bikeId)?.type : d.bike.type;
}

export function draftToInput(d: RequestDraft, ownerId: ID, ownerBikes: Bike[]): NewRequestInput {
  const useGarage = d.category !== 'inspection' && d.bikeChoice === 'garage' && ownerBikes.length > 0;
  const garageBike = useGarage ? ownerBikes.find((b) => b.id === d.bikeId) : undefined;
  return {
    ownerId,
    mechanicId: d.mechanicId!,
    category: d.category!,
    topic: d.topic,
    description: d.description,
    bikeId: garageBike?.id,
    bike: garageBike
      ? { type: garageBike.type, brand: garageBike.brand, model: garageBike.model, name: garageBike.name, notes: d.bike.notes.trim() || undefined }
      : {
          type: d.bike.type!,
          brand: d.bike.brand.trim(),
          model: d.bike.model.trim(),
          name: d.bike.name.trim() || undefined,
          notes: d.bike.notes.trim() || undefined,
          year: d.bike.year,
        },
    // A garage bike needs at least a brand or a model to be recognisable.
    saveBikeToGarage: !garageBike && d.saveBike && Boolean(d.bike.brand.trim() || d.bike.model.trim()),
    inspection: d.category === 'inspection' ? d.inspection : undefined,
    location: d.location!,
    mode: d.mode!,
    availability: {
      preferredDate: d.availability.preferredDate || undefined,
      timeSlots: d.availability.timeSlots,
      // No slot chosen means any time works.
      flexible: d.availability.flexible || d.availability.timeSlots.length === 0,
      notes: d.availability.notes.trim() || undefined,
      urgency: d.availability.urgency,
    },
    photos: d.photos.length ? d.photos : undefined,
  };
}
