// Domain model for the Cromiqa marketplace.
// These types are backend-agnostic: the LocalStorage demo backend and a future
// Supabase backend both speak this shape.

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO timestamp

export type Role = 'owner' | 'mechanic';

export type ServiceCategory = 'repair' | 'maintenance' | 'inspection' | 'diagnosis';

export type BikeType = 'mtb' | 'road' | 'gravel' | 'urban' | 'ebike' | 'folding';

export type Specialization =
  | 'suspension'
  | 'transmission'
  | 'brakes'
  | 'wheels'
  | 'ebike'
  | 'road'
  | 'bikefit'
  | 'restoration'
  | 'urban';

export type ServiceMode = 'home' | 'workshop';

export type LocationId =
  | 'madrid-centro'
  | 'madrid-vallecas'
  | 'madrid-moratalaz'
  | 'rivas'
  | 'arganda'
  | 'coslada'
  | 'san-fernando'
  | 'mejorada'
  | 'velilla';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lunes

export interface User {
  id: ID;
  name: string;
  role: Role;
  email: string;
  location: LocationId;
  /** Present for mechanic accounts. */
  mechanicId?: ID;
  /** Short description shown in the demo account switcher. */
  demoBlurb: string;
}

export interface MechanicService {
  id: ID;
  category: ServiceCategory;
  name: string;
  description: string;
  /** Indicative starting price in euros. Undefined = "a consultar". */
  priceFrom?: number;
  durationMinutes?: number;
}

export interface WeeklyAvailability {
  day: Weekday;
  slots: TimeSlot[];
}

export interface PortfolioItem {
  id: ID;
  title: string;
  description: string;
  bikeType: BikeType;
}

export type ProfileListing = 'pending_verification' | 'active';

export interface Mechanic {
  id: ID;
  userId: ID;
  name: string;
  businessName: string;
  headline: string;
  bio: string;
  yearsExperience: number;
  avatarTone: string;
  baseLocation: LocationId;
  /** Area description of the workshop (no real addresses). */
  workshopArea?: string;
  serviceAreas: LocationId[];
  homeService: boolean;
  workshop: boolean;
  /** Travel supplement for home repairs, in euros. */
  homeServiceFee?: number;
  bikeTypes: BikeType[];
  specializations: Specialization[];
  services: MechanicService[];
  weeklyAvailability: WeeklyAvailability[];
  nextAvailableDate?: ISODate;
  availabilityNote: string;
  responseTime: string;
  languages: string[];
  /** Fictional demo state. Cromiqa has not verified any real professional. */
  demoVerified: boolean;
  /**
   * Publication state of the professional profile: created as a draft in the onboarding,
   * submitted for verification, then active (listed, searchable and able to receive requests).
   * Missing = active (profiles created before verification states existed).
   */
  listing?: ProfileListing;
  portfolio: PortfolioItem[];
}

export interface Review {
  id: ID;
  mechanicId: ID;
  authorName: string;
  rating: number;
  date: ISODate;
  service: string;
  text: string;
  requestId?: ID;
}

export interface Bike {
  id: ID;
  ownerId: ID;
  name: string;
  brand: string;
  model: string;
  type: BikeType;
  year?: number;
  notes?: string;
  /** Data URL (resized client side) — optional. */
  photo?: string;
  createdAt: ISODateTime;
}

export interface MaintenanceRecord {
  id: ID;
  bikeId: ID;
  date: ISODate;
  title: string;
  description: string;
  mechanicId?: ID;
  requestId?: ID;
  cost?: number;
}

/**
 * Status of one invitation (a request sent to one provider). The cyclist's request is the
 * case grouping its invitations; its status is derived (see `domain/logic/cases.ts`).
 */
export type RequestStatus =
  | 'sent'
  | 'awaiting_proposal'
  | 'proposal_received'
  | 'confirmed'
  | 'in_progress'
  /** The mechanic marked the work finished; waiting for the cyclist (or the 72 h closure). */
  | 'awaiting_completion'
  | 'completed'
  | 'cancelled'
  /** The cyclist hired another provider for this request. */
  | 'not_selected';

export interface BikeSnapshot {
  type: BikeType;
  brand: string;
  model: string;
  name?: string;
  notes?: string;
  year?: number;
}

export interface InspectionDetails {
  askingPrice?: number;
  sellerLocation?: string;
  listingReference?: string;
}

export type RequestUrgency = 'none' | 'week' | 'urgent';

export interface RequestAvailability {
  preferredDate?: ISODate;
  timeSlots: TimeSlot[];
  flexible: boolean;
  notes?: string;
  /** How soon the cyclist needs it. A preference, never a promised slot. */
  urgency?: RequestUrgency;
}

/** `withdrawn` also marks a version replaced by a revision; `not_selected` another quote won. */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'not_selected';

export interface Proposal {
  id: ID;
  price: number;
  date: ISODate;
  time: string; // HH:MM
  durationMinutes?: number;
  message: string;
  status: ProposalStatus;
  createdAt: ISODateTime;
  respondedAt?: ISODateTime;
}

export type RequestEventType =
  | 'created'
  | 'accepted_for_review'
  | 'proposal_sent'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'started'
  | 'completed'
  | 'cancelled_by_owner'
  | 'rejected_by_mechanic'
  | 'open_proposal_sent'
  | 'proposal_revised'
  | 'not_selected'
  | 'appointment_proposed'
  | 'appointment_confirmed'
  | 'work_finished'
  | 'completion_confirmed'
  | 'auto_closed'
  | 'incident_opened'
  | 'incident_resolved'
  | 'cancelled_by_mechanic'
  | 'message';

export interface RequestEvent {
  id: ID;
  type: RequestEventType;
  by: Role;
  at: ISODateTime;
  text?: string;
}

/**
 * An open proposal: the provider can't price it yet and says what they need to clarify. It
 * unlocks the conversation without hiring anyone; it is never a binding quote.
 */
export interface OpenProposal {
  message: string;
  createdAt: ISODateTime;
}

/**
 * One invitation: the cyclist's request as sent to one provider, with that provider's
 * response (open proposal, versioned quotes), the conversation and, once hired, the service.
 */
/** A date and time for the service, proposed by either party. */
export interface AppointmentSlot {
  date: ISODate;
  time: string;
  note?: string;
}

/**
 * The appointment is agreed after hiring. A proposal only becomes the appointment when the
 * other party confirms it; a change keeps the confirmed slot until its replacement is accepted.
 */
export interface Appointment {
  confirmed?: AppointmentSlot & { confirmedAt: ISODateTime };
  pending?: AppointmentSlot & { by: Role; at: ISODateTime };
}

/** A problem the cyclist reported after the work was marked finished. Blocks the automatic closure. */
export interface Incident {
  text: string;
  openedAt: ISODateTime;
  resolvedAt?: ISODateTime;
}

export interface ServiceRequest {
  id: ID;
  /** The cyclist's request this invitation belongs to; shared by every invited provider. */
  caseId: ID;
  code: string;
  ownerId: ID;
  mechanicId: ID;
  category: ServiceCategory;
  description: string;
  bikeId?: ID;
  bike: BikeSnapshot;
  inspection?: InspectionDetails;
  location: LocationId;
  mode: ServiceMode;
  availability: RequestAvailability;
  /** Photos the cyclist attached (shared by every invitation of the request). */
  photos?: string[];
  status: RequestStatus;
  /** Closed quotes, oldest first: each revision adds a version and withdraws the previous one. */
  proposals: Proposal[];
  openProposal?: OpenProposal;
  events: RequestEvent[];
  completionSummary?: string;
  appointment?: Appointment;
  /** When the mechanic marked the work finished (starts the 72 h closure clock). */
  finishedAt?: ISODateTime;
  incidents?: Incident[];
  /** Completed by the 72 h administrative closure, not by the cyclist's confirmation. */
  autoClosed?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A decision or answer one person owes on a request (only the cyclist's feed the Request Hub). */
export type PendingActionType = 'quote_decision' | 'appointment_confirmation' | 'information_required' | 'incident_response' | 'service_confirmation';
export type PendingActionStatus = 'pending' | 'resolved' | 'superseded';

/**
 * Its own lifecycle, next to the request's: created by a domain event, resolved only by the
 * matching explicit action (or a valid transition), superseded when a newer version replaces it.
 * Resolved and superseded records stay, for history.
 */
export interface PendingAction {
  id: ID;
  /** The cyclist's request (case) it belongs to. */
  requestId: ID;
  /** The invitation (one mechanic) it is about: where the action is taken. */
  threadId: ID;
  /** Who owes it. */
  userId: ID;
  type: PendingActionType;
  status: PendingActionStatus;
  /** 1 incident · 2 appointment · 3 quote · 4 information · 5 completion (lower = first). */
  priority: 1 | 2 | 3 | 4 | 5;
  sourceEntityType: 'proposal' | 'appointment' | 'open_proposal' | 'incident' | 'completion';
  sourceEntityId: string;
  /** One active action per decision: the same key never has two pending records. */
  key: string;
  createdAt: ISODateTime;
  /** A real deadline (the 72 h administrative closure), if any. */
  dueAt?: ISODateTime;
  resolvedAt?: ISODateTime;
  resolutionReason?: string;
  supersededByActionId?: ID;
}

export interface DemoDatabase {
  version: number;
  /** Decisions owed by cyclists and mechanics (pending, resolved and superseded). */
  pendingActions: PendingAction[];
  users: User[];
  mechanics: Mechanic[];
  reviews: Review[];
  bikes: Bike[];
  maintenance: MaintenanceRecord[];
  requests: ServiceRequest[];
}

export interface NewRequestInput {
  ownerId: ID;
  /** Providers the cyclist chose and confirmed: one invitation each (1–5 per send). */
  mechanicIds: ID[];
  category: ServiceCategory;
  description: string;
  bikeId?: ID;
  bike: BikeSnapshot;
  saveBikeToGarage: boolean;
  inspection?: InspectionDetails;
  location: LocationId;
  mode: ServiceMode;
  availability: RequestAvailability;
  /** Optional photos of the problem (compressed JPEG data URLs in the demo). */
  photos?: string[];
}

export interface ProposalInput {
  price: number;
  date: ISODate;
  time: string;
  durationMinutes?: number;
  message: string;
}

export type BikeInput = Omit<Bike, 'id' | 'createdAt' | 'ownerId'>;

export type MechanicProfilePatch = Partial<
  Pick<
    Mechanic,
    | 'headline'
    | 'bio'
    | 'yearsExperience'
    | 'serviceAreas'
    | 'homeService'
    | 'workshop'
    | 'homeServiceFee'
    | 'bikeTypes'
    | 'specializations'
    | 'services'
    | 'weeklyAvailability'
    | 'nextAvailableDate'
    | 'availabilityNote'
    | 'workshopArea'
  >
>;
