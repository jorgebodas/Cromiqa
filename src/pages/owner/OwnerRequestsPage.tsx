import { RoleGate } from '@/components/layout/RoleGate';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { CyclistHeaderActions, ProfileButton } from '@/components/layout/QuickActions';
import { useNavUi } from '@/state/ui';
import { OwnerRequestsList } from './OwnerRequestsList';

/** Cyclist "Solicitudes" tab: every request, before and after hiring, by status. */
function Inner() {
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  return (
    <>
      <ScreenHeader title="Solicitudes" leading={<ProfileButton />} actions={<CyclistHeaderActions />} />
      <div className="container-page pb-8 sm:pb-10">
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
