// One account, two modes. Everyone can use Cromiqa as a cyclist; mechanic mode exists only
// once the account has a professional profile. Pure functions, shared by UI and tests.
import type { User } from '../types';

export type AppMode = 'cyclist' | 'mechanic';

export function availableModes(user: Pick<User, 'mechanicId'> | null | undefined): AppMode[] {
  if (!user) return ['cyclist'];
  return user.mechanicId ? ['cyclist', 'mechanic'] : ['cyclist'];
}

export function canSwitchMode(user: Pick<User, 'mechanicId'> | null | undefined): boolean {
  return availableModes(user).length > 1;
}

/**
 * The mode to show: the one the account last used if it's still available, otherwise the
 * professional mode for accounts that have it (where they work) and cyclist for the rest.
 */
export function resolveMode(user: Pick<User, 'mechanicId'> | null | undefined, stored?: AppMode): AppMode {
  const modes = availableModes(user);
  if (stored && modes.includes(stored)) return stored;
  return modes.includes('mechanic') ? 'mechanic' : 'cyclist';
}

/** The section each mode opens on when it has no remembered place. */
export const MODE_HOME: Record<AppMode, string> = { cyclist: '/', mechanic: '/pro' };

/** Which mode a path belongs to (shared screens such as the account belong to neither). */
export function modeOfPath(pathname: string): AppMode | null {
  if (pathname === '/pro' || pathname.startsWith('/pro/')) return 'mechanic';
  if (pathname === '/' || ['/mecanicos', '/solicitudes', '/garaje', '/solicitar'].some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return 'cyclist';
  return null;
}
