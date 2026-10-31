import type { Bike, Mechanic, NewRequestInput, ID } from '@/domain/types';
import { bikeTypeLabel } from '@/domain/catalog';
import { MAX_RECIPIENTS_PER_SEND } from '@/domain/logic/requests';
import type { RequestDraft } from '@/state/store';

export const STEP_TITLES = ['¿Qué le pasa?', 'Tu bici', '¿Dónde y cuándo?', 'Mecánicos', 'Revisión'] as const;
export const LAST_STEP = STEP_TITLES.length - 1;

export type DraftErrors = Partial<Record<
  'category' | 'description' | 'bikeId' | 'type' | 'brand' | 'model' | 'location' | 'mode' | 'timeSlots' | 'owner' | 'preferredDate' | 'askingPrice' | 'mechanicIds',
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
      if (!d.bike.brand.trim()) e.brand = 'Indica la marca.';
      if (!d.bike.model.trim()) e.model = 'Indica el modelo (aproximado vale).';
      if (d.inspection.askingPrice !== undefined && (d.inspection.askingPrice < 0 || d.inspection.askingPrice > 50000))
        e.askingPrice = 'Revisa el precio.';
    }
  }
  if (step === 2) {
    if (!d.location) e.location = 'Elige la zona.';
    if (!d.mode) e.mode = 'Elige domicilio o taller.';
    else if (m && d.mode === 'home' && !m.homeService) e.mode = `${m.name} no ofrece servicio a domicilio.`;
    else if (m && d.mode === 'workshop' && !m.workshop) e.mode = `${m.name} solo trabaja a domicilio.`;
    else if (m && d.mode === 'home' && d.location && !m.serviceAreas.includes(d.location))
      e.mode = `${m.name} no se desplaza a esa zona. Elige taller u otra zona.`;
    if (d.availability.timeSlots.length === 0 && !d.availability.flexible)
      e.timeSlots = 'Elige al menos una franja o marca que tienes flexibilidad.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.availability.preferredDate && new Date(d.availability.preferredDate + 'T00:00:00') < today)
      e.preferredDate = 'La fecha no puede estar en el pasado.';
  }
  if (step === 3) {
    if (d.mechanicIds.length === 0) e.mechanicIds = 'Elige al menos un mecánico.';
    else if (d.mechanicIds.length > MAX_RECIPIENTS_PER_SEND) e.mechanicIds = `Elige ${MAX_RECIPIENTS_PER_SEND} como máximo.`;
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
    mechanicIds: d.mechanicIds,
    category: d.category!,
    description: d.description,
    bikeId: garageBike?.id,
    bike: garageBike
      ? { type: garageBike.type, brand: garageBike.brand, model: garageBike.model, name: garageBike.name, notes: d.bike.notes.trim() || undefined }
      : {
          type: d.bike.type!,
          brand: d.bike.brand,
          model: d.bike.model,
          name: d.bike.name.trim() || undefined,
          notes: d.bike.notes.trim() || undefined,
          year: d.bike.year,
        },
    saveBikeToGarage: !garageBike && d.saveBike,
    inspection: d.category === 'inspection' ? d.inspection : undefined,
    location: d.location!,
    mode: d.mode!,
    availability: {
      preferredDate: d.availability.preferredDate || undefined,
      timeSlots: d.availability.timeSlots,
      flexible: d.availability.flexible,
      notes: d.availability.notes.trim() || undefined,
    },
  };
}
