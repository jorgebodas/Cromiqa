import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { AccessGate } from './access/AccessGate';
import { useApp } from './state/store';

// The admin panel has its own login and is loaded only when visited (#/admin).
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })));
const isAdminHash = () => window.location.hash.startsWith('#/admin');

function Root() {
  const [admin, setAdmin] = useState(isAdminHash);
  useEffect(() => {
    const on = () => setAdmin(isAdminHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (admin) {
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  }
  return (
    <AccessGate>
      <App />
    </AccessGate>
  );
}

const root = createRoot(document.getElementById('root')!);

// Hydrate demo data before the first render so screens never flash empty states.
useApp
  .getState()
  .init()
  .finally(() => {
    root.render(
      <StrictMode>
        <Root />
      </StrictMode>,
    );
  });
