import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/owner/HomePage';
import { FindMechanicPage } from '@/pages/owner/FindMechanicPage';
import { MechanicProfilePage } from '@/pages/owner/MechanicProfilePage';
import { RequestFlowPage } from '@/pages/owner/request/RequestFlowPage';
import { RequestSentPage } from '@/pages/owner/RequestSentPage';
import { ActivityPage } from '@/pages/owner/ActivityPage';
import { OwnerRequestsPage } from '@/pages/owner/OwnerRequestsPage';
import { OwnerRequestDetailPage } from '@/pages/owner/OwnerRequestDetailPage';
import { OwnerCasePage } from '@/pages/owner/OwnerCasePage';
import { GaragePage } from '@/pages/owner/garage/GaragePage';
import { BikeDetailPage } from '@/pages/owner/garage/BikeDetailPage';
import { AccountPage } from '@/pages/owner/AccountPage';
import { DashboardPage } from '@/pages/mechanic/DashboardPage';
import { MechanicRequestsPage, MechanicWorkPage } from '@/pages/mechanic/MechanicRequestsPage';
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
          <Route path="solicitudes" element={<OwnerRequestsPage />} />
          {/* The bell: notifications. */}
          <Route path="actividad" element={<ActivityPage />} />
          {/* A request (case) and, inside it, one invited mechanic's thread. */}
          <Route path="solicitudes/:id" element={<OwnerCasePage />} />
          <Route path="solicitudes/:id/mecanico/:threadId" element={<OwnerRequestDetailPage />} />
          <Route path="solicitudes/:id/enviada" element={<RequestSentPage />} />
          <Route path="garaje" element={<GaragePage />} />
          <Route path="garaje/:id" element={<BikeDetailPage />} />
          <Route path="cuenta" element={<AccountPage />} />
          <Route path="pro" element={<DashboardPage />} />
          <Route path="pro/solicitudes" element={<MechanicRequestsPage />} />
          <Route path="pro/solicitudes/:id" element={<MechanicRequestDetailPage />} />
          <Route path="pro/trabajos" element={<MechanicWorkPage />} />
          {/* Catalogue and availability: reached from the profile. */}
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
