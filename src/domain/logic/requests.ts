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
  | { type: 'send_open_proposal'; message: string }
  | { type: 'send_proposal'; proposal: ProposalInput }
  | { type: 'revise_proposal'; proposal: ProposalInput }
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
  // Open proposal: can't price yet; opens the conversation, hires nobody.
  send_open_proposal: { by: 'mechanic', from: ['sent', 'awaiting_proposal'], to: 'awaiting_proposal' },
  send_proposal: { by: 'mechanic', from: ['sent', 'awaiting_proposal'], to: 'proposal_received' },
  // A pending quote can be revised; the new version needs the cyclist's explicit approval.
  revise_proposal: { by: 'mechanic', from: ['proposal_received'], to: 'proposal_received' },
  accept_proposal: { by: 'owner', from: ['proposal_received'], to: 'confirmed' },
  // Rejecting a quote closes that invitation only; the request and its other invitations go on.
  reject_proposal: { by: 'owner', from: ['proposal_received'], to: 'cancelled' },
  reject_request: { by: 'mechanic', from: ['sent', 'awaiting_proposal', 'proposal_received'], to: 'cancelled' },
  cancel_by_owner: { by: 'owner', from: ['sent', 'awaiting_proposal', 'proposal_received', 'confirmed'], to: 'cancelled' },
  start: { by: 'mechanic', from: ['confirmed'], to: 'in_progress' },
  complete: { by: 'mechanic', from: ['in_progress'], to: 'completed' },
};

/** Hired: a quote was accepted for this invitation. */
export function isHired(r: ServiceRequest) {
  return r.proposals.some((p) => p.status === 'accepted');
}

/**
 * The conversation opens with an open proposal, or once a quote is accepted; never just
 * because a quote was sent. It closes when the invitation is over.
 */
export function chatUnlocked(r: ServiceRequest): boolean {
  if (['cancelled', 'completed', 'not_selected'].includes(r.status)) return false;
  return Boolean(r.openProposal) || isHired(r);
}

export function canPerform(request: ServiceRequest, action: RequestAction['type'], role: Role): boolean {
  if (action === 'message') return chatUnlocked(request);
  const rule = RULES[action];
  return rule.by === role && rule.from.includes(request.status);
}

/** All invitations of the same cyclist request. */
export function caseThreads(db: Pick<DemoDatabase, 'requests'>, caseId: ID): ServiceRequest[] {
  return db.requests.filter((r) => r.caseId === caseId);
}

export const MAX_RECIPIENTS_PER_SEND = 5;

/** The request's own fields, independent of who receives it. */
export function validateRequestInput(input: NewRequestInput, db: DemoDatabase): Record<string, string> {
  const errors: Record<string, string> = {};
  const ids = new Set(input.mechanicIds);
  if (ids.size === 0) errors.mechanicIds = 'Elige al menos un mecánico.';
  else if (ids.size > MAX_RECIPIENTS_PER_SEND) errors.mechanicIds = `Puedes enviarla a ${MAX_RECIPIENTS_PER_SEND} mecánicos como máximo cada vez.`;
  for (const id of errors.mechanicIds ? [] : ids) {
    const first = Object.values(validateForMechanic(input, id, db))[0];
    if (first) {
      errors.mechanicIds = first;
      break;
    }
  }
  if (!db.users.some((u) => u.id === input.ownerId)) errors.ownerId = 'Elige una cuenta.';
  if (input.description.trim().length < 10) errors.description = 'Describe el problema con al menos 10 caracteres.';
  if (!input.bike.brand.trim()) errors.brand = 'Indica la marca.';
  if (!input.bike.model.trim()) errors.model = 'Indica el modelo.';
  if (input.availability.timeSlots.length === 0 && !input.availability.flexible)
    errors.timeSlots = 'Elige al menos una franja o marca que tienes flexibilidad.';
  return errors;
}

/** Whether one provider can take this request: service, bike, modality, coverage, not self. */
export function validateForMechanic(
  input: Pick<NewRequestInput, 'ownerId' | 'category' | 'bike' | 'mode' | 'location'>,
  mechanicId: ID,
  db: Pick<DemoDatabase, 'mechanics' | 'users'>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const mechanic = db.mechanics.find((m) => m.id === mechanicId);
  if (!mechanic) errors.mechanicId = 'Elige un mecánico.';
  // Any account can request a service as a cyclist, just not from its own workshop.
  const owner = db.users.find((u) => u.id === input.ownerId);
  if (mechanic && owner?.mechanicId === mechanic.id) errors.mechanicId = 'No puedes enviarte una solicitud a ti mismo.';
  if (mechanic) {
    if (!mechanic.services.some((s) => s.category === input.category)) errors.category = `${mechanic.name} no ofrece este servicio.`;
    if (input.bike.type && !mechanic.bikeTypes.includes(input.bike.type)) errors.type = `${mechanic.name} no trabaja con este tipo de bici.`;
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

/**
 * Sends one request to the chosen providers: one invitation each, all sharing a case id.
 * Nothing is sent automatically; the caller passes the recipients the cyclist confirmed.
 */
export function createRequest(
  db: DemoDatabase,
  input: NewRequestInput,
  now = new Date(),
): { db: DemoDatabase; requests: ServiceRequest[] } {
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

  const caseId = uid('case');
  const base = {
    caseId,
    ownerId: input.ownerId,
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
  };
  const requests = invitationsFor(db, base, [...new Set(input.mechanicIds)], now);
  return { db: { ...db, bikes, requests: [...requests, ...db.requests] }, requests };
}

type CaseFields = Omit<ServiceRequest, 'id' | 'code' | 'mechanicId' | 'status' | 'proposals' | 'openProposal' | 'events' | 'createdAt' | 'updatedAt' | 'completionSummary'>;

function invitationsFor(db: DemoDatabase, base: CaseFields, mechanicIds: ID[], now: Date): ServiceRequest[] {
  let next = Number(nextCode(db).replace(/\D/g, ''));
  return mechanicIds.map((mechanicId) => ({
    ...base,
    id: uid('req'),
    code: `CRQ-${next++}`,
    mechanicId,
    status: 'sent' as const,
    proposals: [],
    events: [event('created', 'owner', now)],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }));
}

/**
 * Invites more providers to an existing request, keeping earlier invitations and quotes.
 * Skips providers already invited; refuses once the request is hired or withdrawn.
 */
export function inviteToCase(
  db: DemoDatabase,
  caseId: ID,
  ownerId: ID,
  mechanicIds: ID[],
  now = new Date(),
): { db: DemoDatabase; requests: ServiceRequest[] } {
  const threads = caseThreads(db, caseId);
  const first = threads[0];
  if (!first || first.ownerId !== ownerId) throw new DomainError('No encontramos esta solicitud.');
  if (threads.some(isHired)) throw new DomainError('Esta solicitud ya tiene un servicio contratado.');
  if (threads.every((r) => r.status === 'cancelled' && r.events.some((e) => e.type === 'cancelled_by_owner')))
    throw new DomainError('Retiraste esta solicitud.');
  const fresh = [...new Set(mechanicIds)].filter((id) => !threads.some((r) => r.mechanicId === id));
  if (fresh.length === 0) throw new DomainError('Esos mecánicos ya tienen tu solicitud.');
  if (fresh.length > MAX_RECIPIENTS_PER_SEND) throw new DomainError(`Puedes invitar a ${MAX_RECIPIENTS_PER_SEND} mecánicos como máximo cada vez.`);
  for (const id of fresh) {
    const err = Object.values(validateForMechanic(first, id, db))[0];
    if (err) throw new DomainError(err);
  }
  const { id: _i, code: _c, mechanicId: _m, status: _s, proposals: _p, openProposal: _o, events: _e, createdAt: _ca, updatedAt: _u, completionSummary: _cs, ...base } = first;
  const requests = invitationsFor(db, base, fresh, now);
  return { db: { ...db, requests: [...requests, ...db.requests] }, requests };
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
    case 'send_open_proposal': {
      const message = action.message.trim();
      if (message.length < 10) throw new DomainError('Explica qué necesitas aclarar (al menos 10 caracteres).');
      req.openProposal = { message, createdAt: now.toISOString() };
      req.events = [...req.events, event('open_proposal_sent', 'mechanic', now, message)];
      break;
    }
    case 'send_proposal':
    case 'revise_proposal': {
      const errors = validateProposal(action.proposal, now);
      const first = Object.values(errors)[0];
      if (first) throw new DomainError(first);
      req.proposals = [
        ...req.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'withdrawn' as const } : p)),
        { id: uid('prop'), ...action.proposal, message: action.proposal.message.trim(), status: 'pending', createdAt: now.toISOString() },
      ];
      req.events = [...req.events, event(action.type === 'revise_proposal' ? 'proposal_revised' : 'proposal_sent', 'mechanic', now, action.proposal.message.trim())];
      break;
    }
    case 'accept_proposal':
    case 'reject_proposal': {
      const accepted = action.type === 'accept_proposal';
      // One booking per request.
      if (accepted && caseThreads(db, req.caseId).some((r) => r.id !== req.id && isHired(r)))
        throw new DomainError('Ya contrataste otro mecánico para esta solicitud.');
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
  let requests = db.requests.map((r) => (r.id === requestId ? req : r));
  // Hiring one provider closes the other invitations of the same request.
  if (action.type === 'accept_proposal') {
    requests = requests.map((r) =>
      r.caseId === req.caseId && r.id !== req.id && !['cancelled', 'completed', 'not_selected'].includes(r.status)
        ? {
            ...r,
            status: 'not_selected' as const,
            proposals: r.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'not_selected' as const } : p)),
            events: [...r.events, event('not_selected', 'owner', now)],
            updatedAt: now.toISOString(),
          }
        : r,
    );
  }
  return { db: { ...db, maintenance, requests }, request: req };
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
