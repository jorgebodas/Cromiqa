import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useCurrentUser } from '@/state/selectors';
import { useOwnerActivity } from '@/state/activity';
import { useMode } from '@/state/mode';
import { Avatar, cx } from '@/components/ui';
import { headerButtonClass } from './ScreenHeader';

/**
 * Top-left of every main screen (phones; desktop has it in the top bar): the avatar, which
 * opens the profile, where the account also switches mode.
 */
/**
 * The account, top-right on phones: photo or initials. Notifications live inside it now (the
 * Request Hub is where proposals and quotes are followed): the badge counts unread updates.
 */
export function ProfileAvatarButton() {
  const user = useCurrentUser();
  const mode = useMode();
  const { unread } = useOwnerActivity(user && mode === 'cyclist' ? user.id : undefined);
  return (
    <Link
      to="/cuenta"
      aria-label={unread ? `Tu perfil y notificaciones, ${unread} sin leer` : 'Tu perfil'}
      className={cx(headerButtonClass, 'md:hidden')}
      data-testid="account-link"
    >
      <span className="block size-11 overflow-hidden rounded-full">
        {user ? <Avatar name={user.name} size="sm" className="size-11 text-sm" /> : <UserRound className="m-auto mt-3 size-5" aria-hidden />}
      </span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper ring-2 ring-paper" aria-hidden>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

/** Phone header actions in cyclist mode: the account (with notifications inside). */
export function CyclistHeaderActions() {
  return (
    <span className="flex items-center gap-2 md:hidden">
      <ProfileAvatarButton />
    </span>
  );
}
