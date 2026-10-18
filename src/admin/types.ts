export interface WaitlistLead {
  id: string;
  email: string;
  zone: string | null;
  source: string;
  created_at: string;
}

export type MechanicStatus = 'new' | 'contacted' | 'talking' | 'onboarded' | 'discarded';

export interface MechanicLead {
  id: string;
  name: string;
  workshop: string | null;
  email: string;
  phone: string | null;
  zone: string | null;
  specialty: string | null;
  status: MechanicStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const MECHANIC_STATUSES: { id: MechanicStatus; label: string }[] = [
  { id: 'new', label: 'Nuevo' },
  { id: 'contacted', label: 'Contactado' },
  { id: 'talking', label: 'En conversación' },
  { id: 'onboarded', label: 'Dado de alta' },
  { id: 'discarded', label: 'Descartado' },
];

export const statusLabel = (s: MechanicStatus) => MECHANIC_STATUSES.find((x) => x.id === s)?.label ?? s;
