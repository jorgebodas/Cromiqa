// Labels and reference data used across the UI. Keep user-facing Spanish copy here.
import type {
  BikeType,
  LocationId,
  RequestStatus,
  ServiceCategory,
  ServiceMode,
  Specialization,
  TimeSlot,
  Weekday,
} from './types';

export const CATEGORIES: { id: ServiceCategory; label: string; short: string; description: string }[] = [
  {
    id: 'repair',
    label: 'Reparación',
    short: 'Reparar',
    description: 'Algo se ha roto o no funciona bien: cambios, frenos, pinchazos, ruidos.',
  },
  {
    id: 'maintenance',
    label: 'Mantenimiento',
    short: 'Mantener',
    description: 'Puesta a punto, revisión periódica o mantenimiento de suspensiones.',
  },
  {
    id: 'inspection',
    label: 'Inspección antes de comprar',
    short: 'Inspeccionar',
    description: 'Revisa una bici de segunda mano antes de pagar por ella.',
  },
  {
    id: 'diagnosis',
    label: 'No sé qué le pasa a mi bici',
    short: 'Diagnosticar',
    description: 'Cuéntanos qué notas y un mecánico te ayudará a encontrar el problema.',
  },
];

export const categoryLabel = (c: ServiceCategory) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

export const BIKE_TYPES: { id: BikeType; label: string }[] = [
  { id: 'mtb', label: 'Montaña (MTB)' },
  { id: 'road', label: 'Carretera' },
  { id: 'gravel', label: 'Gravel' },
  { id: 'urban', label: 'Urbana' },
  { id: 'ebike', label: 'Eléctrica' },
  { id: 'folding', label: 'Plegable' },
];

export const bikeTypeLabel = (t: BikeType) => BIKE_TYPES.find((x) => x.id === t)?.label ?? t;

export const SPECIALIZATIONS: { id: Specialization; label: string; keywords: string[] }[] = [
  {
    id: 'suspension',
    label: 'Suspensiones',
    keywords: ['suspension', 'suspensiones', 'horquilla', 'amortiguador', 'retenes', 'fox', 'rockshox'],
  },
  {
    id: 'transmission',
    label: 'Transmisión y cambios',
    keywords: ['cambio', 'cambios', 'marchas', 'desviador', 'cadena', 'transmision', 'pinon', 'pinones', 'plato', 'salta', 'saltan'],
  },
  {
    id: 'brakes',
    label: 'Frenos',
    keywords: ['freno', 'frenos', 'pastillas', 'purgar', 'purga', 'hidraulico', 'chirria', 'chirrido', 'disco'],
  },
  {
    id: 'wheels',
    label: 'Ruedas',
    keywords: ['rueda', 'ruedas', 'pinchazo', 'pincha', 'radio', 'radios', 'centrar', 'llanta', 'tubeless', 'cubierta', 'buje'],
  },
  {
    id: 'ebike',
    label: 'Bicis eléctricas',
    keywords: ['electrica', 'electricas', 'ebike', 'e-bike', 'motor', 'bateria', 'asistencia'],
  },
  { id: 'road', label: 'Carretera', keywords: ['carretera', 'ruta', 'carbono'] },
  { id: 'bikefit', label: 'Bike fitting', keywords: ['bikefit', 'bike fit', 'fitting', 'postura', 'sillin', 'molestias', 'rodilla'] },
  { id: 'restoration', label: 'Restauración', keywords: ['restauracion', 'restaurar', 'vintage', 'clasica', 'antigua'] },
  { id: 'urban', label: 'Urbana y plegable', keywords: ['urbana', 'plegable', 'brompton', 'paseo', 'ciudad'] },
];

export const specializationLabel = (s: Specialization) =>
  SPECIALIZATIONS.find((x) => x.id === s)?.label ?? s;

export const LOCATIONS: { id: LocationId; label: string; short: string }[] = [
  { id: 'madrid-centro', label: 'Madrid · Centro', short: 'Madrid Centro' },
  { id: 'madrid-vallecas', label: 'Madrid · Vallecas', short: 'Vallecas' },
  { id: 'madrid-moratalaz', label: 'Madrid · Moratalaz', short: 'Moratalaz' },
  { id: 'rivas', label: 'Rivas-Vaciamadrid', short: 'Rivas' },
  { id: 'arganda', label: 'Arganda del Rey', short: 'Arganda' },
  { id: 'coslada', label: 'Coslada', short: 'Coslada' },
  { id: 'san-fernando', label: 'San Fernando de Henares', short: 'San Fernando' },
  { id: 'mejorada', label: 'Mejorada del Campo', short: 'Mejorada' },
  { id: 'velilla', label: 'Velilla de San Antonio', short: 'Velilla' },
];

export const locationLabel = (l: LocationId) => LOCATIONS.find((x) => x.id === l)?.label ?? l;
export const locationShort = (l: LocationId) => LOCATIONS.find((x) => x.id === l)?.short ?? l;

/**
 * Approximate road distance in km between area centres. This is static
 * reference data for the demo — never a geolocation calculation.
 */
const DISTANCES: Record<string, number> = {
  'madrid-centro|madrid-vallecas': 6,
  'madrid-centro|madrid-moratalaz': 6,
  'madrid-centro|rivas': 20,
  'madrid-centro|arganda': 28,
  'madrid-centro|coslada': 15,
  'madrid-centro|san-fernando': 17,
  'madrid-centro|mejorada': 22,
  'madrid-centro|velilla': 27,
  'madrid-vallecas|madrid-moratalaz': 4,
  'madrid-vallecas|rivas': 12,
  'madrid-vallecas|arganda': 20,
  'madrid-vallecas|coslada': 10,
  'madrid-vallecas|san-fernando': 13,
  'madrid-vallecas|mejorada': 18,
  'madrid-vallecas|velilla': 20,
  'madrid-moratalaz|rivas': 14,
  'madrid-moratalaz|arganda': 22,
  'madrid-moratalaz|coslada': 8,
  'madrid-moratalaz|san-fernando': 10,
  'madrid-moratalaz|mejorada': 15,
  'madrid-moratalaz|velilla': 19,
  'rivas|arganda': 10,
  'rivas|coslada': 15,
  'rivas|san-fernando': 14,
  'rivas|mejorada': 12,
  'rivas|velilla': 8,
  'arganda|coslada': 20,
  'arganda|san-fernando': 17,
  'arganda|mejorada': 12,
  'arganda|velilla': 7,
  'coslada|san-fernando': 3,
  'coslada|mejorada': 8,
  'coslada|velilla': 14,
  'san-fernando|mejorada': 6,
  'san-fernando|velilla': 11,
  'mejorada|velilla': 6,
};

export function approxDistanceKm(a: LocationId, b: LocationId): number {
  if (a === b) return 0;
  return DISTANCES[`${a}|${b}`] ?? DISTANCES[`${b}|${a}`] ?? 30;
}

export const MODES: { id: ServiceMode; label: string; description: string }[] = [
  { id: 'home', label: 'A domicilio', description: 'El mecánico va a tu casa o lugar de trabajo.' },
  { id: 'workshop', label: 'En taller', description: 'Llevas la bici al taller del mecánico.' },
];

export const modeLabel = (m: ServiceMode) => MODES.find((x) => x.id === m)?.label ?? m;

export const TIME_SLOTS: { id: TimeSlot; label: string; hours: string }[] = [
  { id: 'morning', label: 'Mañana', hours: '9:00–14:00' },
  { id: 'afternoon', label: 'Tarde', hours: '16:00–19:00' },
  { id: 'evening', label: 'Última hora', hours: '19:00–21:00' },
];

export const slotLabel = (s: TimeSlot) => TIME_SLOTS.find((x) => x.id === s)?.label ?? s;

export const WEEKDAYS: { id: Weekday; label: string; short: string }[] = [
  { id: 0, label: 'Lunes', short: 'L' },
  { id: 1, label: 'Martes', short: 'M' },
  { id: 2, label: 'Miércoles', short: 'X' },
  { id: 3, label: 'Jueves', short: 'J' },
  { id: 4, label: 'Viernes', short: 'V' },
  { id: 5, label: 'Sábado', short: 'S' },
  { id: 6, label: 'Domingo', short: 'D' },
];

export type StatusTone = 'neutral' | 'waiting' | 'action' | 'positive' | 'progress' | 'done' | 'muted';

export const STATUSES: Record<
  RequestStatus,
  { label: string; ownerHint: string; mechanicHint: string; tone: StatusTone; step: number }
> = {
  sent: {
    label: 'Solicitud enviada',
    ownerHint: 'El mecánico aún no ha revisado tu solicitud.',
    mechanicHint: 'Responde con un presupuesto cerrado, una propuesta abierta si necesitas aclarar algo, o dile que no puedes.',
    tone: 'neutral',
    step: 0,
  },
  awaiting_proposal: {
    label: 'Esperando presupuesto',
    ownerHint: 'El mecánico está valorando tu caso y te enviará precio y fecha.',
    mechanicHint: 'Cuando lo tengas claro, envía un presupuesto cerrado con precio y fecha.',
    tone: 'waiting',
    step: 1,
  },
  proposal_received: {
    label: 'Presupuesto recibido',
    ownerHint: 'Revisa el precio y la cita propuestos. Aún no hay nada reservado.',
    mechanicHint: 'Propuesta enviada. Esperando la respuesta del cliente.',
    tone: 'action',
    step: 2,
  },
  confirmed: {
    label: 'Confirmada',
    ownerHint: 'Has aceptado la propuesta. La cita está acordada.',
    mechanicHint: 'Cita acordada con el cliente.',
    tone: 'positive',
    step: 3,
  },
  not_selected: {
    label: 'No seleccionada',
    ownerHint: 'Contrataste a otro mecánico para esta solicitud.',
    mechanicHint: 'El cliente eligió otra propuesta para esta solicitud.',
    tone: 'neutral',
    step: -1,
  },
  in_progress: {
    label: 'En curso',
    ownerHint: 'El mecánico está trabajando en tu bici.',
    mechanicHint: 'Trabajo en curso. Márcalo como completado al terminar.',
    tone: 'progress',
    step: 4,
  },
  completed: {
    label: 'Completada',
    ownerHint: 'Servicio terminado. Queda registrado en tu garaje.',
    mechanicHint: 'Trabajo completado.',
    tone: 'done',
    step: 5,
  },
  cancelled: {
    label: 'Cancelada',
    ownerHint: 'Esta solicitud ya no está activa.',
    mechanicHint: 'Esta solicitud ya no está activa.',
    tone: 'muted',
    step: -1,
  },
};

export const STATUS_ORDER: RequestStatus[] = [
  'sent',
  'awaiting_proposal',
  'proposal_received',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
];
