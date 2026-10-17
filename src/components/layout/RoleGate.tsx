import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { UserRound, Wrench } from 'lucide-react';
import type { Role } from '@/domain/types';
import { useCurrentUser } from '@/state/selectors';
import { useApp } from '@/state/store';
import { Avatar, EmptyState } from '@/components/ui';
import { useSwitchAccount } from './AccountSwitcher';

/**
 * Shows children only for the given role. Otherwise explains why and offers a
 * one-click switch to a matching demo account (no fake login).
 */
export function RoleGate({ role, children, reason }: { role: Role; children: ReactNode; reason?: string }) {
  const user = useCurrentUser();
  const users = useApp((s) => s.db.users);
  const switchAccount = useSwitchAccount();
  const loc = useLocation();
  if (user?.role === role) return <>{children}</>;

  const candidates = users.filter((u) => u.role === role).slice(0, 4);
  const isOwner = role === 'owner';
  return (
    <div className="container-page py-10">
      <EmptyState
        as="h1"
        icon={isOwner ? <UserRound className="size-6" /> : <Wrench className="size-6" />}
        title={isOwner ? (user ? 'Esta sección es para propietarios' : 'Entra con una cuenta de demostración') : 'Panel para mecánicos'}
        description={
          reason ??
          (isOwner
            ? 'En la versión real aquí iniciarías sesión. En la demo, elige una cuenta ficticia de propietario.'
            : 'Elige una cuenta ficticia de mecánico para gestionar solicitudes y tu perfil público.')
        }
        action={
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {candidates.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => switchAccount(u.id, { to: loc.pathname + loc.search })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5 text-left hover:border-ink"
                >
                  <Avatar name={u.name} size="sm" />
                  <span>
                    <span className="block text-sm font-semibold">Continuar como {u.name.split(' ')[0]}</span>
                    <span className="block text-xs text-muted">{u.demoBlurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
