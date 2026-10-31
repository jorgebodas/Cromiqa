// Service-request lifecycle as pure functions: (db, input) -> new db.
// Any backend (LocalStorage today, Supabase tomorrow) can reuse these rules.
import type {
  Bike,
  DemoDatabase,
  ID,
  MaintenanceRecord,
  NewRequestInput,
  ProposalInput,
  RequestEvent,
  RequestEventType,
  RequestStatus,
  Role,
  ServiceRequest,
} from '../types';
import { categoryLabel } from '../catalog';
import { toISODate, uid } from '../utils';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export type RequestAction =
  | { type: 'accept_for_review' }
  | { type: 'send_proposal'; proposal: ProposalInput }
  | { type: 'accept_proposal' }
  | { type: 'reject_proposal'; reason?: string }
  | { type: 'reject_request'; reason?: string }
  | { type: 'cancel_by_owner'; reason?: string }
  | { type: 'start' }
  | { type: 'complete'; summary?: string }
  | { type: 'message'; text: string; by: Role };

/** Which role may perform an action and from which statuses. */
const RULES: Record<Exclude<RequestAction['type'], 'message'>, { by: Role; from: RequestStatus[]; to: RequestStatus }> = {
  accept_for_review: { by: 'mechanic', from: ['sent'], to: 'awaiting_proposal' },
  send_proposal: { by: 'mechanic', from: ['sent', 'awaiting_proposal'], to: 'proposal_received' },
  accept_proposal: { by: 'owner', from: ['proposal_received'], to: 'confirmed' },
  reject_proposal: { by: 'owner', from: ['proposal_received'], to: 'awaiting_proposal' },
  reject_request: { by: 'mechanic', from: ['sent', 'awaiting_proposal', 'proposal_received'], to: 'cancelled' },
  cancel_by_owner: { by: 'owner', from: ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed'], to: 'cancelled' },
  start: { by: 'mechanic', from: ['confirmed'], to: 'in_progress' },
  complete: { by: 'mechanic', from: ['in_progress'], to: 'completed' },
};

export function canPerform(request: ServiceRequest, action: RequestAction['type'], role: Role): boolean {
  if (action === 'message') return request.status !== 'cancelled' && request.status !== 'completed';
  const rule = RULES[action];
  return rule.by === role && rule.from.includes(request.status);
}

export function validateRequestInput(input: NewRequestInput, db: DemoDatabase): Record<string, string> {
  const errors: Record<string, string> = {};
  const mechanic = db.mechanics.find((m) => m.id === input.mechanicId);
  if (!mechanic) errors.mechanicId = 'Elige un mecánico.';
  // Any account can request a service as a cyclist, just not from its own workshop.
  const owner = db.users.find((u) => u.id === input.ownerId);
  if (!owner) errors.ownerId = 'Elige una cuenta.';
  else if (mechanic && owner.mechanicId === mechanic.id) errors.mechanicId = 'No puedes enviarte una solicitud a ti mismo.';
  if (input.description.trim().length < 10) errors.description = 'Describe el problema con al menos 10 caracteres.';
  if (!input.bike.brand.trim()) errors.brand = 'Indica la marca.';
  if (!input.bike.model.trim()) errors.model = 'Indica el modelo.';
  if (input.availability.timeSlots.length === 0 && !input.availability.flexible)
    errors.timeSlots = 'Elige al menos una franja o marca que tienes flexibilidad.';
  if (mechanic) {
    if (input.mode === 'home' && !mechanic.homeService) errors.mode = `${mechanic.name} no ofrece servicio a domicilio.`;
    if (input.mode === 'workshop' && !mechanic.workshop) errors.mode = `${mechanic.name} solo trabaja a domicilio.`;
    if (input.mode === 'home' && mechanic.homeService && !mechanic.serviceAreas.includes(input.location))
      errors.location = `${mechanic.name} no se desplaza a esa zona.`;
  }
  return errors;
}

function event(type: RequestEventType, by: Role, now: Date, text?: string): RequestEvent {
  return { id: uid('ev'), type, by, at: now.toISOString(), text };
}

function nextCode(db: DemoDatabase): string {
  const max = db.requests.reduce((acc, r) => Math.max(acc, Number(r.code.replace(/\D/g, '')) || 0), 1000);
  return `CRQ-${max + 1}`;
}

export function createRequest(
  db: DemoDatabase,
  input: NewRequestInput,
  now = new Date(),
): { db: DemoDatabase; request: ServiceRequest } {
  const errors = validateRequestInput(input, db);
  const first = Object.values(errors)[0];
  if (first) throw new DomainError(first);

  let bikes = db.bikes;
  let bikeId = input.bikeId;
  if (bikeId && !db.bikes.some((b) => b.id === bikeId && b.ownerId === input.ownerId)) {
    throw new DomainError('La bici seleccionada no está en tu garaje.');
  }
  if (!bikeId && input.saveBikeToGarage) {
    const bike: Bike = {
      id: uid('bike'),
      ownerId: input.ownerId,
      name: input.bike.name?.trim() || `${input.bike.brand} ${input.bike.model}`.trim(),
      brand: input.bike.brand.trim(),
      model: input.bike.model.trim(),
      type: input.bike.type,
      year: input.bike.year,
      notes: input.bike.notes?.trim() || undefined,
      createdAt: now.toISOString(),
    };
    bikes = [...bikes, bike];
    bikeId = bike.id;
  }
  const garageBike = bikeId ? bikes.find((b) => b.id === bikeId) : undefined;

  const request: ServiceRequest = {
    id: uid('req'),
    code: nextCode(db),
    ownerId: input.ownerId,
    mechanicId: input.mechanicId,
    category: input.category,
    description: input.description.trim(),
    bikeId,
    bike: garageBike
      ? { type: garageBike.type, brand: garageBike.brand, model: garageBike.model, name: garageBike.name, year: garageBike.year, notes: input.bike.notes || garageBike.notes }
      : { ...input.bike, brand: input.bike.brand.trim(), model: input.bike.model.trim() },
    inspection: input.category === 'inspection' ? input.inspection : undefined,
    location: input.location,
    mode: input.mode,
    availability: input.availability,
    status: 'sent',
    proposals: [],
    events: [event('created', 'owner', now)],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return { db: { ...db, bikes, requests: [request, ...db.requests] }, request };
}

export function validateProposal(p: ProposalInput, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(p.price) || p.price <= 0) errors.price = 'Indica un precio mayor que 0 €.';
  else if (p.price > 5000) errors.price = 'El precio parece demasiado alto. Revísalo.';
  if (!p.date) errors.date = 'Elige una fecha.';
  else if (p.date < toISODate(now)) errors.date = 'La fecha no puede estar en el pasado.';
  if (!/^\d{2}:\d{2}$/.test(p.time)) errors.time = 'Indica una hora (HH:MM).';
  if (p.message.trim().length < 5) errors.message = 'Añade un mensaje breve para el cliente.';
  return errors;
}

export function applyRequestAction(
  db: DemoDatabase,
  requestId: ID,
  action: RequestAction,
  actor: Role,
  now = new Date(),
): { db: DemoDatabase; request: ServiceRequest } {
  const current = db.requests.find((r) => r.id === requestId);
  if (!current) throw new DomainError('No encontramos esta solicitud.');
  if (!canPerform(current, action.type, actor)) {
    throw new DomainError('Esta acción ya no está disponible para el estado actual de la solicitud.');
  }

  let req: ServiceRequest = { ...current, updatedAt: now.toISOString() };
  let maintenance = db.maintenance;

  switch (action.type) {
    case 'accept_for_review':
      req.events = [...req.events, event('accepted_for_review', 'mechanic', now)];
      break;
    case 'send_proposal': {
      const errors = validateProposal(action.proposal, now);
      const first = Object.values(errors)[0];
      if (first) throw new DomainError(first);
      req.proposals = [
        ...req.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'withdrawn' as const } : p)),
        { id: uid('prop'), ...action.proposal, message: action.proposal.message.trim(), status: 'pending', createdAt: now.toISOString() },
      ];
      req.events = [...req.events, event('proposal_sent', 'mechanic', now, action.proposal.message.trim())];
      break;
    }
    case 'accept_proposal':
    case 'reject_proposal': {
      const accepted = action.type === 'accept_proposal';
      req.proposals = req.proposals.map((p) =>
        p.status === 'pending' ? { ...p, status: accepted ? 'accepted' : 'rejected', respondedAt: now.toISOString() } : p,
      );
      req.events = [
        ...req.events,
        event(accepted ? 'proposal_accepted' : 'proposal_rejected', 'owner', now, accepted ? undefined : action.reason),
      ];
      break;
    }
    case 'reject_request':
      req.proposals = req.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'withdrawn' } : p));
      req.events = [...req.events, event('rejected_by_mechanic', 'mechanic', now, action.reason)];
      break;
    case 'cancel_by_owner':
      req.proposals = req.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'withdrawn' } : p));
      req.events = [...req.events, event('cancelled_by_owner', 'owner', now, action.reason)];
      break;
    case 'start':
      req.events = [...req.events, event('started', 'mechanic', now)];
      break;
    case 'complete': {
      const summary = action.summary?.trim() || undefined;
      req.completionSummary = summary;
      req.events = [...req.events, event('completed', 'mechanic', now, summary)];
      if (req.bikeId) {
        const accepted = req.proposals.find((p) => p.status === 'accepted');
        const record: MaintenanceRecord = {
          id: uid('mnt'),
          bikeId: req.bikeId,
          date: toISODate(now),
          title: categoryLabel(req.category),
          description: summary ?? req.description,
          mechanicId: req.mechanicId,
          requestId: req.id,
          cost: accepted?.price,
        };
        maintenance = [record, ...maintenance];
      }
      break;
    }
    case 'message': {
      const text = action.text.trim();
      if (!text) throw new DomainError('Escribe un mensaje.');
      req.events = [...req.events, event('message', action.by, now, text)];
      break;
    }
  }

  if (action.type !== 'message') req.status = RULES[action.type].to;
  req = { ...req };
  return {
    db: { ...db, maintenance, requests: db.requests.map((r) => (r.id === requestId ? req : r)) },
    request: req,
  };
}

export function currentProposal(req: ServiceRequest) {
  return [...req.proposals].reverse().find((p) => p.status !== 'withdrawn');
}

export function addReview(
  db: DemoDatabase,
  requestId: ID,
  ownerId: ID,
  input: { rating: number; text: string },
  now = new Date(),
): DemoDatabase {
  const req = db.requests.find((r) => r.id === requestId);
  if (!req || req.ownerId !== ownerId) throw new DomainError('No encontramos esta solicitud.');
  if (req.status !== 'completed') throw new DomainError('Solo puedes valorar servicios completados.');
  if (db.reviews.some((r) => r.requestId === requestId)) throw new DomainError('Ya has valorado este servicio.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new DomainError('Elige una puntuación de 1 a 5.');
  if (input.text.trim().length < 5) throw new DomainError('Escribe un breve comentario.');
  const owner = db.users.find((u) => u.id === ownerId);
  const [first = 'Usuario', last = ''] = (owner?.name ?? '').split(' ');
  return {
    ...db,
    reviews: [
      {
        id: uid('rv'),
        mechanicId: req.mechanicId,
        authorName: `${first} ${last ? `${last[0]}.` : ''}`.trim(),
        rating: input.rating,
        date: toISODate(now),
        service: categoryLabel(req.category),
        text: input.text.trim(),
        requestId,
      },
      ...db.reviews,
    ],
  };
}
