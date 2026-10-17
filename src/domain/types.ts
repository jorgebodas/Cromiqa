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

export type RequestStatus =
  | 'sent'
  | 'awaiting_proposal'
  | 'proposal_received'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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

export interface RequestAvailability {
  preferredDate?: ISODate;
  timeSlots: TimeSlot[];
  flexible: boolean;
  notes?: string;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

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
  | 'message';

export interface RequestEvent {
  id: ID;
  type: RequestEventType;
  by: Role;
  at: ISODateTime;
  text?: string;
}

export interface ServiceRequest {
  id: ID;
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
  status: RequestStatus;
  proposals: Proposal[];
  events: RequestEvent[];
  completionSummary?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DemoDatabase {
  version: number;
  users: User[];
  mechanics: Mechanic[];
  reviews: Review[];
  bikes: Bike[];
  maintenance: MaintenanceRecord[];
  requests: ServiceRequest[];
}

export interface NewRequestInput {
  ownerId: ID;
  mechanicId: ID;
  category: ServiceCategory;
  description: string;
  bikeId?: ID;
  bike: BikeSnapshot;
  saveBikeToGarage: boolean;
  inspection?: InspectionDetails;
  location: LocationId;
  mode: ServiceMode;
  availability: RequestAvailability;
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
