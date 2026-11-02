import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions } from '@/components/layout/QuickActions';
import { OwnerRequestsList } from './OwnerRequestsList';

/** Cyclist "Solicitudes" tab: every request, before and after hiring, by status. */
function Inner() {
  // No creation button here: the + in the dock (or the header on desktop) starts a request.
  return (
    <>
      <ScreenHeader title="Solicitudes" description="Tus servicios y reparaciones." actions={<CyclistHeaderActions />} />
      <div className="container-page pb-8 sm:pb-10">
        <OwnerRequestsList />
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
