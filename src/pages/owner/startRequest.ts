import { CircleHelp, ScanSearch, Settings2, Wrench } from 'lucide-react';
import type { ServiceCategory, ServiceTopic } from '@/domain/types';
import { SERVICE_TOPICS } from '@/domain/catalog';
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

/**
 * From Home's service carousel: the same new-request flow, with the service (and its category)
 * already chosen; the cyclist then describes the actual problem.
 */
export function useStartService() {
  const resetDraft = useApp((s) => s.resetDraft);
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  return (topic: ServiceTopic) => {
    resetDraft({ topic, category: SERVICE_TOPICS.find((t) => t.id === topic)!.category });
    openNewRequest();
  };
}
