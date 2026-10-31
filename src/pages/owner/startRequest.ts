import { useNavigate } from 'react-router-dom';
import { CircleHelp, ScanSearch, Settings2, Wrench } from 'lucide-react';
import type { ServiceCategory } from '@/domain/types';
import { useApp } from '@/state/store';
import { buildSearchParams } from './searchParams';

export const CATEGORY_ICONS: Record<ServiceCategory, typeof Wrench> = {
  repair: Wrench,
  maintenance: Settings2,
  inspection: ScanSearch,
  diagnosis: CircleHelp,
};

/** The four needs, as offered by "Nueva solicitud" and the home widget. */
export const NEED_OPTIONS: { id: ServiceCategory; label: string }[] = [
  { id: 'repair', label: 'Reparación' },
  { id: 'maintenance', label: 'Mantenimiento' },
  { id: 'inspection', label: 'Inspección antes de comprar' },
  { id: 'diagnosis', label: 'No sé qué le pasa' },
];

/**
 * Starts a request for a need: seeds the draft with the category and opens Mecánicos filtered
 * by it; picking a mechanic continues in the request flow with the category preselected.
 */
export function useStartRequest() {
  const navigate = useNavigate();
  const resetDraft = useApp((s) => s.resetDraft);
  return (category: ServiceCategory) => {
    resetDraft({ category });
    navigate(`/mecanicos?${buildSearchParams({ category, fromHome: true })}`);
  };
}
