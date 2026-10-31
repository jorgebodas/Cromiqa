import { Link, NavLink } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { useCurrentUser } from '@/state/selectors';
import { useOwnerActivity } from '@/state/activity';
import { Avatar, cx } from '@/components/ui';
import { headerButtonClass } from './ScreenHeader';

/**
 * Activity and account, as round header buttons on the cyclist's main screens (phones; on
 * desktop the top bar already has them).
 */
export function OwnerQuickActions() {
  const user = useCurrentUser();
  const { unread } = useOwnerActivity(user?.role === 'owner' ? user.id : undefined);
  return (
    <>
      <NavLink
        to="/actividad"
        aria-label={unread ? `Actividad, ${unread} ${unread === 1 ? 'novedad' : 'novedades'} sin leer` : 'Actividad'}
        className={cx(headerButtonClass, 'md:hidden')}
        data-testid="activity-link"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper ring-2 ring-paper" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </NavLink>
      <Link to="/cuenta" aria-label="Tu cuenta" className={cx(headerButtonClass, 'overflow-hidden md:hidden')} data-testid="account-link">
        {user ? <Avatar name={user.name} size="sm" className="size-11 text-sm" /> : <UserRound className="size-5" aria-hidden />}
      </Link>
    </>
  );
}
