import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/owner/HomePage';
import { FindMechanicPage } from '@/pages/owner/FindMechanicPage';
import { MechanicProfilePage } from '@/pages/owner/MechanicProfilePage';
import { RequestFlowPage } from '@/pages/owner/request/RequestFlowPage';
import { RequestSentPage } from '@/pages/owner/RequestSentPage';
import { ActivityPage } from '@/pages/owner/ActivityPage';
import { OwnerRequestDetailPage } from '@/pages/owner/OwnerRequestDetailPage';
import { GaragePage } from '@/pages/owner/garage/GaragePage';
import { BikeDetailPage } from '@/pages/owner/garage/BikeDetailPage';
import { AccountPage } from '@/pages/owner/AccountPage';
import { DashboardPage } from '@/pages/mechanic/DashboardPage';
import { MechanicRequestsPage } from '@/pages/mechanic/MechanicRequestsPage';
import { MechanicRequestDetailPage } from '@/pages/mechanic/MechanicRequestDetailPage';
import { ServicesPage } from '@/pages/mechanic/ServicesPage';
import { AvailabilityPage } from '@/pages/mechanic/AvailabilityPage';
import { ProfilePage } from '@/pages/mechanic/ProfilePage';
import { DemoPanelPage } from '@/pages/demo/DemoPanelPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Hash routing: deep links and refreshes work on GitHub Pages without server rewrites.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="mecanicos" element={<FindMechanicPage />} />
          <Route path="mecanicos/:id" element={<MechanicProfilePage />} />
          <Route path="solicitar" element={<RequestFlowPage />} />
          <Route path="actividad" element={<ActivityPage />} />
          {/* Old entry point: the request list now lives in Actividad. */}
          <Route path="solicitudes" element={<Navigate to="/actividad" replace />} />
          <Route path="solicitudes/:id" element={<OwnerRequestDetailPage />} />
          <Route path="solicitudes/:id/enviada" element={<RequestSentPage />} />
          <Route path="garaje" element={<GaragePage />} />
          <Route path="garaje/:id" element={<BikeDetailPage />} />
          <Route path="cuenta" element={<AccountPage />} />
          <Route path="pro" element={<DashboardPage />} />
          <Route path="pro/solicitudes" element={<MechanicRequestsPage />} />
          <Route path="pro/solicitudes/:id" element={<MechanicRequestDetailPage />} />
          <Route path="pro/servicios" element={<ServicesPage />} />
          <Route path="pro/disponibilidad" element={<AvailabilityPage />} />
          <Route path="pro/perfil" element={<ProfilePage />} />
          <Route path="demo" element={<DemoPanelPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
