import { CircleHelp, ScanSearch, Settings2, Wrench } from 'lucide-react';
import type { ServiceCategory } from '@/domain/types';
import { useApp } from '@/state/store';
import { useNavUi } from '@/state/ui';

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
 * Request-first: starts a new request for a need, in the Request Hub. The flow asks what's
 * wrong, which bike and where, then shows matching providers to choose from.
 */
export function useStartRequest() {
  const resetDraft = useApp((s) => s.resetDraft);
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  return (category: ServiceCategory) => {
    resetDraft({ category });
    openNewRequest();
  };
}
