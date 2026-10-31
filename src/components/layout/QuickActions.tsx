import { Link, NavLink } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { useCurrentUser } from '@/state/selectors';
import { useOwnerActivity } from '@/state/activity';
import { useMode } from '@/state/mode';
import { Avatar, cx } from '@/components/ui';
import { headerButtonClass } from './ScreenHeader';

/**
 * Top-left of every main screen (phones; desktop has it in the top bar): the avatar, which
 * opens the profile, where the account also switches mode.
 */
/** Cyclist notifications bell, with the number of updates not seen yet. */
export function NotificationsButton({ className }: { className?: string }) {
  const user = useCurrentUser();
  const mode = useMode();
  const { unread } = useOwnerActivity(user && mode === 'cyclist' ? user.id : undefined);
  return (
    <NavLink
      to="/actividad"
      aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
      className={cx(headerButtonClass, className)}
      data-testid="activity-link"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper ring-2 ring-paper" aria-hidden>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  );
}

/** The account, top-right on phones: photo or initials. Opens Perfil. */
export function ProfileAvatarButton() {
  const user = useCurrentUser();
  return (
    <Link to="/cuenta" aria-label="Tu perfil" className={cx(headerButtonClass, 'overflow-hidden md:hidden')} data-testid="account-link">
      {user ? <Avatar name={user.name} size="sm" className="size-11 text-sm" /> : <UserRound className="size-5" aria-hidden />}
    </Link>
  );
}

/** Phone header actions in cyclist mode: notifications and the account. */
export function CyclistHeaderActions() {
  return (
    <span className="flex items-center gap-2 md:hidden">
      <NotificationsButton />
      <ProfileAvatarButton />
    </span>
  );
}
