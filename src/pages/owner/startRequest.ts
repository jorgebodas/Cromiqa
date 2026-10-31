import { useNavigate } from 'react-router-dom';
import { CircleHelp, ScanSearch, Settings2, Wrench } from 'lucide-react';
import type { ServiceCategory } from '@/domain/types';
import { useApp } from '@/state/store';

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
 * Request-first: starts a new request for a need. The flow asks what's wrong, which bike and
 * where, then shows matching providers to choose from.
 */
export function useStartRequest() {
  const navigate = useNavigate();
  const resetDraft = useApp((s) => s.resetDraft);
  return (category: ServiceCategory) => {
    resetDraft({ category });
    navigate('/solicitar');
  };
}
