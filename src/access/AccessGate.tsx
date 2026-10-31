// Private-preview gate. The public sees a "coming soon" page; testers open the prototype from
// the round button in the waitlist card ("Avísame") or the direct link #/entrar, both of which
// show the password form inside the same dock card (see marketing/LeadDock.tsx).
import { useEffect, useState, type ReactNode } from 'react';
import { ComingSoonPage } from '@/marketing/ComingSoonPage';
import { SECRET_ROUTE, gateEnabled, onUnlocked, openTesterLogin, readUnlocked } from './testerLogin';

export { ACCESS_KEY, gateEnabled, lockDevice } from './testerLogin';

export function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => !gateEnabled || readUnlocked());

  useEffect(() => {
    if (unlocked) return;
    // The dock (a child) is mounted by now, so it hears this.
    const openIfSecret = () => window.location.hash.startsWith(SECRET_ROUTE) && openTesterLogin();
    openIfSecret();
    window.addEventListener('hashchange', openIfSecret);
    const off = onUnlocked(() => {
      if (window.location.hash.startsWith(SECRET_ROUTE)) window.location.hash = '#/';
      setUnlocked(true);
    });
    return () => {
      window.removeEventListener('hashchange', openIfSecret);
      off();
    };
  }, [unlocked]);

  return unlocked ? <>{children}</> : <ComingSoonPage />;
}
