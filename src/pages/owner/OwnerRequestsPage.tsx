import { Plus } from 'lucide-react';
import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions } from '@/components/layout/QuickActions';
import { useNavUi } from '@/state/ui';
import { OwnerRequestsList } from './OwnerRequestsList';

/** Cyclist "Solicitudes" tab: every request, before and after hiring, by status. */
function Inner() {
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  return (
    <>
      <ScreenHeader title="Solicitudes" actions={<CyclistHeaderActions />} />
      <div className="container-page pb-8 sm:pb-10">
        {/* Always a way to start another request from here (the floating dock may be showing the Hub). */}
        <button
          type="button"
          onClick={openNewRequest}
          className="mb-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-lime px-5 font-semibold text-ink transition-colors hover:bg-lime-deep"
          data-testid="requests-new"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden /> Nueva solicitud
        </button>
        <OwnerRequestsList onNewRequest={openNewRequest} />
      </div>
    </>
  );
}

export function OwnerRequestsPage() {
  return (
    <RoleGate role="owner">
      <Inner />
    </RoleGate>
  );
}
