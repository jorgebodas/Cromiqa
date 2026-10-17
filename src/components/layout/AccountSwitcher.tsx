import { useLocation, useNavigate } from 'react-router-dom';
import { Check, UserRound, Wrench } from 'lucide-react';
import type { ID, User } from '@/domain/types';
import { useApp } from '@/state/store';
import { Avatar, Dialog, DemoTag, cx } from '@/components/ui';

/** Hook that switches the demo account and moves to a sensible screen for the new role. */
export function useSwitchAccount() {
  const switchUser = useApp((s) => s.switchUser);
  const users = useApp((s) => s.db.users);
  const toast = useApp((s) => s.toast);
  const navigate = useNavigate();
  const location = useLocation();

  return (userId: ID | null, opts: { to?: string } = {}) => {
    const user = users.find((u) => u.id === userId) ?? null;
    switchUser(userId);
    toast(user ? `Ahora usas la cuenta de ${user.name}` : 'Navegas como invitado', 'info');
    if (opts.to) return navigate(opts.to);
    const onPro = location.pathname.startsWith('/pro');
    if (user?.role === 'mechanic' && !onPro) navigate('/pro');
    else if (user?.role !== 'mechanic' && onPro) navigate(user ? '/solicitudes' : '/');
  };
}

function AccountRow({ user, active, onPick }: { user: User | null; active: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-current={active || undefined}
        className={cx(
          'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
          active ? 'border-ink bg-sand' : 'border-transparent hover:bg-sand',
        )}
      >
        {user ? (
          <Avatar name={user.name} size="sm" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-sand-deep" aria-hidden>
            <UserRound className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{user ? user.name : 'Invitado'}</span>
          <span className="block truncate text-xs text-muted">{user ? user.demoBlurb : 'Explora sin cuenta'}</span>
        </span>
        {active && <Check className="size-4" aria-label="Cuenta activa" />}
      </button>
    </li>
  );
}

export function AccountSwitcherDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const users = useApp((s) => s.db.users);
  const current = useApp((s) => s.sessionUserId);
  const switchAccount = useSwitchAccount();
  const owners = users.filter((u) => u.role === 'owner');
  const mechanics = users.filter((u) => u.role === 'mechanic');
  const pick = (id: ID | null) => {
    onClose();
    if (id !== current) switchAccount(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cambiar de cuenta"
      description="Cuentas ficticias del entorno de demostración. El cambio es inmediato y no requiere contraseña."
    >
      <div className="space-y-5">
        <ul className="space-y-1">
          <AccountRow user={null} active={current === null} onPick={() => pick(null)} />
        </ul>
        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-2">
            <UserRound className="size-3.5" aria-hidden /> Propietarios de bicis
          </h3>
          <ul className="space-y-1">
            {owners.map((u) => (
              <AccountRow key={u.id} user={u} active={u.id === current} onPick={() => pick(u.id)} />
            ))}
          </ul>
        </section>
        <section>
          <h3 className="eyebrow mb-2 flex items-center gap-2">
            <Wrench className="size-3.5" aria-hidden /> Mecánicos
          </h3>
          <ul className="space-y-1">
            {mechanics.map((u) => (
              <AccountRow key={u.id} user={u} active={u.id === current} onPick={() => pick(u.id)} />
            ))}
          </ul>
        </section>
        <p className="flex items-center gap-2 text-xs text-muted">
          <DemoTag /> Personas y negocios inventados. No aceptan reservas reales.
        </p>
      </div>
    </Dialog>
  );
}
