import type { Bike, BikeInput, DemoDatabase, ID, Mechanic, MechanicProfilePatch, User } from '../types';
import { DomainError } from './requests';
import { uid } from '../utils';

export function validateBike(input: BikeInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = 'Ponle un nombre a tu bici.';
  if (!input.brand.trim()) errors.brand = 'Indica la marca.';
  if (!input.model.trim()) errors.model = 'Indica el modelo.';
  const year = input.year;
  if (year !== undefined && (year < 1950 || year > new Date().getFullYear() + 1)) errors.year = 'Año no válido.';
  return errors;
}

function assertValid(errors: Record<string, string>) {
  const first = Object.values(errors)[0];
  if (first) throw new DomainError(first);
}

export function addBike(db: DemoDatabase, ownerId: ID, input: BikeInput, now = new Date()) {
  assertValid(validateBike(input));
  const bike: Bike = { ...input, id: uid('bike'), ownerId, name: input.name.trim(), createdAt: now.toISOString() };
  return { db: { ...db, bikes: [...db.bikes, bike] }, bike };
}

export function updateBike(db: DemoDatabase, ownerId: ID, bikeId: ID, input: BikeInput) {
  assertValid(validateBike(input));
  const existing = db.bikes.find((b) => b.id === bikeId && b.ownerId === ownerId);
  if (!existing) throw new DomainError('No encontramos esta bici en tu garaje.');
  const bike: Bike = { ...existing, ...input, name: input.name.trim() };
  return { db: { ...db, bikes: db.bikes.map((b) => (b.id === bikeId ? bike : b)) }, bike };
}

/** Removing a bike keeps past requests (they hold a snapshot) but drops its link. */
export function removeBike(db: DemoDatabase, ownerId: ID, bikeId: ID): DemoDatabase {
  if (!db.bikes.some((b) => b.id === bikeId && b.ownerId === ownerId)) throw new DomainError('No encontramos esta bici.');
  return {
    ...db,
    bikes: db.bikes.filter((b) => b.id !== bikeId),
    maintenance: db.maintenance.filter((m) => m.bikeId !== bikeId),
    requests: db.requests.map((r) => (r.bikeId === bikeId ? { ...r, bikeId: undefined } : r)),
  };
}

export function validateMechanicPatch(patch: MechanicProfilePatch): Record<string, string> {
  const errors: Record<string, string> = {};
  if (patch.bio !== undefined && patch.bio.trim().length < 30) errors.bio = 'La presentación debe tener al menos 30 caracteres.';
  if (patch.headline !== undefined && !patch.headline.trim()) errors.headline = 'Añade una especialidad principal.';
  if (patch.specializations && patch.specializations.length === 0) errors.specializations = 'Elige al menos una especialidad.';
  if (patch.bikeTypes && patch.bikeTypes.length === 0) errors.bikeTypes = 'Elige al menos un tipo de bici.';
  if (patch.homeService === false && patch.workshop === false) errors.mode = 'Ofrece al menos taller o domicilio.';
  if (patch.homeService && patch.serviceAreas && patch.serviceAreas.length === 0)
    errors.serviceAreas = 'Elige al menos una zona a la que te desplazas.';
  if (patch.yearsExperience !== undefined && (patch.yearsExperience < 0 || patch.yearsExperience > 60))
    errors.yearsExperience = 'Años de experiencia no válidos.';
  if (patch.services) {
    if (patch.services.length === 0) errors.services = 'Ofrece al menos un servicio.';
    patch.services.forEach((s, i) => {
      if (!s.name.trim()) errors[`service-${i}`] = 'Cada servicio necesita un nombre.';
      if (s.priceFrom !== undefined && (!Number.isFinite(s.priceFrom) || s.priceFrom < 0))
        errors[`service-${i}`] = 'Revisa los precios: deben ser 0 € o más.';
    });
  }
  return errors;
}

export function updateMechanic(db: DemoDatabase, mechanicId: ID, patch: MechanicProfilePatch) {
  assertValid(validateMechanicPatch(patch));
  const existing = db.mechanics.find((m) => m.id === mechanicId);
  if (!existing) throw new DomainError('Perfil no encontrado.');
  const mechanic: Mechanic = { ...existing, ...patch };
  return { db: { ...db, mechanics: db.mechanics.map((m) => (m.id === mechanicId ? mechanic : m)) }, mechanic };
}

export function updateUser(db: DemoDatabase, userId: ID, patch: Partial<Pick<User, 'name' | 'location'>>) {
  if (patch.name !== undefined && patch.name.trim().length < 2) throw new DomainError('Escribe tu nombre.');
  const existing = db.users.find((u) => u.id === userId);
  if (!existing) throw new DomainError('Cuenta no encontrada.');
  const user = { ...existing, ...patch };
  return { db: { ...db, users: db.users.map((u) => (u.id === userId ? user : u)) }, user };
}
