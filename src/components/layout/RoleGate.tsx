import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Bike, UserRound, Wrench } from 'lucide-react';
import type { Role } from '@/domain/types';
import { availableModes } from '@/domain/logic/modes';
import { useCurrentUser } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useApp } from '@/state/store';
import { Avatar, Button, EmptyState } from '@/components/ui';
import { useSwitchAccount, useSwitchMode } from './AccountSwitcher';

/**
 * Shows children only in the right mode. `owner` screens need any account in cyclist mode,
 * `mechanic` screens an account with a professional profile in mechanic mode, and no role
 * just a signed-in account. Otherwise it explains why and offers the way in: switching mode
 * when the account has it, or a demo account (no fake login).
 */
export function RoleGate({ role, children, reason }: { role?: Role; children: ReactNode; reason?: string }) {
  const user = useCurrentUser();
  const mode = useMode();
  const users = useApp((s) => s.db.users);
  const switchAccount = useSwitchAccount();
  const switchMode = useSwitchMode();
  const loc = useLocation();
  const wanted = role === 'mechanic' ? 'mechanic' : role === 'owner' ? 'cyclist' : null;
  if (user && (!wanted || mode === wanted)) return <>{children}</>;

  // Signed in, wrong mode, but the account has the right one: offer to switch.
  if (user && wanted && availableModes(user).includes(wanted)) {
    return (
      <div className="container-page py-10">
        <EmptyState
          as="h1"
          icon={wanted === 'mechanic' ? <Wrench className="size-6" /> : <Bike className="size-6" />}
          title={wanted === 'mechanic' ? 'Esto es del modo mecánico' : 'Esto es del modo ciclista'}
          description="Tu cuenta tiene los dos modos. Cambia para ver esta sección."
          action={<Button onClick={() => switchMode(wanted)}>{wanted === 'mechanic' ? 'Cambiar a modo mecánico' : 'Cambiar a modo ciclista'}</Button>}
        />
      </div>
    );
  }

  const isOwner = wanted !== 'mechanic';
  const candidates = users.filter((u) => (isOwner ? u.role === 'owner' : Boolean(u.mechanicId))).slice(0, 4);
  return (
    <div className="container-page py-10">
      <EmptyState
        as="h1"
        icon={isOwner ? <UserRound className="size-6" /> : <Wrench className="size-6" />}
        title={isOwner ? 'Entra con una cuenta de demostración' : 'Panel para mecánicos'}
        description={
          reason ??
          (isOwner
            ? 'En la versión real aquí iniciarías sesión. En la demo, elige una cuenta ficticia.'
            : user
              ? 'Tu cuenta aún no tiene perfil profesional. En la demo, entra con una cuenta ficticia de mecánico.'
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
