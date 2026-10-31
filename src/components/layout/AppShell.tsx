import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigationType } from 'react-router-dom';
import { Bell, Bike, CalendarClock, FlaskConical, House, Inbox, LayoutDashboard, Menu, Plus, RefreshCw, UserRound, Wrench } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { useCurrentUser } from '@/state/selectors';
import { useApp } from '@/state/store';
import { useOwnerActivity } from '@/state/activity';
import { useNavUi } from '@/state/ui';
import { Avatar, Toaster, cx } from '@/components/ui';
import { AccountSwitcherDialog } from './AccountSwitcher';
import { NewRequestSheet } from './NewRequestSheet';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof House;
  end?: boolean;
  badge?: number;
}

/** The professional navigation is unchanged: five sections, top links on desktop and tabs on phones. */
function useMechanicNavItems(): NavItem[] {
  const user = useCurrentUser();
  const requests = useApp((s) => s.db.requests);
  const pending = requests.filter((r) => r.mechanicId === user?.mechanicId && (r.status === 'sent' || r.status === 'awaiting_proposal')).length;
  return [
    { to: '/pro', label: 'Panel principal', short: 'Panel', icon: LayoutDashboard, end: true },
    { to: '/pro/solicitudes', label: 'Solicitudes', short: 'Solicitudes', icon: Inbox, badge: pending },
    { to: '/pro/servicios', label: 'Servicios', short: 'Servicios', icon: Wrench },
    { to: '/pro/disponibilidad', label: 'Disponibilidad', short: 'Agenda', icon: CalendarClock },
    { to: '/pro/perfil', label: 'Mi perfil', short: 'Perfil', icon: UserRound },
  ];
}

// ── Cyclist navigation ───────────────────────────────────────────────────────
// Three destinations (bottom bar), one global action (+), and a header with account,
// search and activity. Screen-specific actions live inside each screen.

interface OwnerTab {
  id: 'inicio' | 'mecanicos' | 'garaje';
  root: string;
  label: string;
  icon: typeof House;
  owns: (path: string) => boolean;
}

const OWNER_TABS: OwnerTab[] = [
  { id: 'inicio', root: '/', label: 'Inicio', icon: House, owns: (p) => p === '/' },
  { id: 'mecanicos', root: '/mecanicos', label: 'Mecánicos', icon: Wrench, owns: (p) => p === '/mecanicos' || p.startsWith('/mecanicos/') },
  { id: 'garaje', root: '/garaje', label: 'Garaje', icon: Bike, owns: (p) => p === '/garaje' || p.startsWith('/garaje/') },
];

/** Focused flows hide the bottom bar and the + so nothing competes with finishing the task. */
const FOCUSED_ROUTES = ['/solicitar'];
/** Screens with their own sticky primary action hide the bar on phones too. */
const OWN_ACTION_ROUTES = ['/mecanicos/:id'];

/**
 * Each tab remembers where you left it (filters live in the URL) so switching tabs and
 * coming back restores the same list; tapping the active tab returns to its root.
 */
function useTabMemory() {
  const { pathname, search } = useLocation();
  const memory = useRef<Record<string, string>>({});
  const tab = OWNER_TABS.find((t) => t.owns(pathname));
  if (tab) memory.current[tab.id] = pathname + search;
  return (t: OwnerTab) => (t.id === tab?.id ? t.root : (memory.current[t.id] ?? t.root));
}

function BellLink({ unread, className }: { unread: number; className?: string }) {
  return (
    <NavLink
      to="/actividad"
      aria-label={unread ? `Actividad, ${unread} ${unread === 1 ? 'novedad' : 'novedades'} sin leer` : 'Actividad'}
      className={({ isActive }) =>
        cx('relative flex size-12 items-center justify-center rounded-full transition-colors hover:bg-sand md:size-10', isActive && 'bg-sand', className)
      }
      data-testid="activity-link"
    >
      <Bell className="size-6 md:size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 md:right-1 md:top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper" aria-hidden>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </NavLink>
  );
}

function AccountLink({ className }: { className?: string }) {
  const user = useCurrentUser();
  return (
    <Link to="/cuenta" aria-label="Tu cuenta" className={cx('flex size-12 items-center justify-center rounded-full md:size-10', className)} data-testid="account-link">
      {user ? (
        <Avatar name={user.name} size="sm" className="size-10 text-sm md:size-8 md:text-xs" />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-full bg-sand md:size-8">
          <UserRound className="size-5 md:size-4" aria-hidden />
        </span>
      )}
    </Link>
  );
}

/**
 * Phones only: scrolling down shrinks the tab bar to one circle showing where you are;
 * scrolling up, reaching the top, or tapping the circle brings it back.
 */
function useCondensedChrome() {
  const [condensed, setCondensed] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        if (y < 48) setCondensed(false);
        else if (delta > 6) setCondensed(true);
        else if (delta < -6) setCondensed(false);
        if (Math.abs(delta) > 6) last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  useEffect(() => setCondensed(false), [pathname]);
  return [condensed, () => setCondensed(false)] as const;
}

/** Desktop only: logo · destinations · new request, activity, account. Phones use each screen's header. */
function OwnerHeader({ tabHref, onNewRequest }: { tabHref: (t: OwnerTab) => string; onNewRequest: () => void }) {
  const user = useCurrentUser();
  const { unread } = useOwnerActivity(user?.role === 'owner' ? user.id : undefined);
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-paper/90 backdrop-blur md:block">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to="/" className="rounded-md" aria-label="Cromiqa, inicio">
          <Wordmark className="text-[22px]" />
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-1">
            {OWNER_TABS.map((t) => (
              <li key={t.id}>
                <Link
                  to={tabHref(t)}
                  state={{ tab: true }}
                  aria-current={t.owns(pathname) ? 'page' : undefined}
                  className={cx(
                    'flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors',
                    t.owns(pathname) ? 'bg-sand text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewRequest}
            className="mr-2 flex h-10 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-semibold text-ink transition-colors hover:bg-lime-deep"
          >
            <Plus className="size-4" aria-hidden /> Nueva solicitud
          </button>
          <BellLink unread={unread} />
          <AccountLink />
        </div>
      </div>
    </header>
  );
}

function OwnerBottomNav({
  tabHref,
  onNewRequest,
  condensed,
  expand,
}: {
  tabHref: (t: OwnerTab) => string;
  onNewRequest: () => void;
  condensed: boolean;
  expand: () => void;
}) {
  const { pathname } = useLocation();
  const current = OWNER_TABS.find((t) => t.owns(pathname));
  const CurrentIcon = current?.icon ?? Menu;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div
          className={cx(
            'pointer-events-auto relative h-16 overflow-hidden rounded-full border border-line bg-paper/95 shadow-card backdrop-blur transition-[width] duration-300 ease-out',
            condensed ? 'w-16' : 'w-[calc(100%-76px)]',
          )}
        >
          <nav aria-label="Principal (móvil)" className={cx('h-full p-1 transition-opacity duration-200', condensed ? 'opacity-0' : 'opacity-100')} {...(condensed ? { inert: '' } : {})}>
            <ul className="grid h-full min-w-[220px] grid-cols-3">
              {OWNER_TABS.map((t) => {
                const active = t.owns(pathname);
                return (
                  <li key={t.id}>
                    <Link
                      to={tabHref(t)}
                      state={{ tab: true }}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition-colors',
                        active ? 'bg-sand text-ink' : 'text-muted',
                      )}
                    >
                      <t.icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* Condensed: one circle with the current section; tapping it opens the bar again. */}
          <button
            type="button"
            onClick={expand}
            aria-label={`${current ? current.label : 'Menú'}. Mostrar menú`}
            tabIndex={condensed ? 0 : -1}
            aria-hidden={!condensed || undefined}
            className={cx(
              'absolute inset-0 flex items-center justify-center text-ink transition-opacity duration-200',
              condensed ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            data-testid="nav-condensed"
          >
            <CurrentIcon className="size-7" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onNewRequest}
          aria-label="Nueva solicitud"
          className="pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full bg-lime text-ink shadow-card transition-transform active:scale-95"
          data-testid="new-request-fab"
        >
          <Plus className="size-7" strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function DemoBanner({ onSwitch }: { onSwitch: () => void }) {
  const user = useCurrentUser();
  return (
    <div className="bg-ink text-paper">
      <div className="container-page flex h-9 items-center justify-between gap-3 text-xs">
        <p className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-3.5 shrink-0 text-lime" aria-hidden />
          <span className="whitespace-nowrap font-semibold">Entorno de demostración</span>
          <span className="hidden truncate text-paper/60 sm:inline">· Datos y profesionales ficticios</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onSwitch}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-lime"
            data-testid="demo-switch"
          >
            <RefreshCw className="size-3 shrink-0" aria-hidden />
            <span className="max-w-24 truncate sm:max-w-none">
              {user ? user.name.split(' ')[0] : 'Invitado'}
              {user && <span className="hidden sm:inline"> · {user.role === 'mechanic' ? 'mecánico' : 'propietario'}</span>}
            </span>
            <span className="hidden sm:inline text-paper/60">· Cambiar</span>
          </button>
          <Link to="/demo" className="rounded-full px-2.5 py-1 font-medium text-paper/80 hover:bg-paper/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-lime">
            <span className="sm:hidden">Panel</span>
            <span className="hidden sm:inline">Panel demo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Desktop only; on phones each screen has its own header and the tabs sit at the bottom. */
function MechanicHeader({ items, onSwitch }: { items: NavItem[]; onSwitch: () => void }) {
  const user = useCurrentUser();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-paper/90 backdrop-blur md:block">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to="/pro" className="flex items-center gap-2 rounded-md" aria-label="Cromiqa, inicio">
          <Wordmark className="text-[22px]" />
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">Pro</span>
        </Link>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'relative flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-sand text-ink' : 'text-muted hover:text-ink',
                    )
                  }
                >
                  {item.label}
                  {!!item.badge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1.5 text-[11px] font-bold text-ink">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={onSwitch}
          className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-sm font-medium hover:border-line-strong md:hidden"
          aria-label="Cambiar de cuenta de demostración"
        >
          {user ? <Avatar name={user.name} size="sm" /> : <span className="flex size-8 items-center justify-center rounded-full bg-sand"><UserRound className="size-4" aria-hidden /></span>}
          <span className="max-w-24 truncate">{user ? user.name.split(' ')[0] : 'Invitado'}</span>
        </button>
      </div>
    </header>
  );
}

function MechanicBottomTabs({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Principal (móvil)" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-ink' : 'text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-sand')}>
                    <item.icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {item.short}
                  {!!item.badge && (
                    <span className="absolute right-[calc(50%-22px)] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-sand/60 pb-24 md:pb-0">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Wordmark className="text-lg" />
          <p className="text-sm text-muted">Tu bici, en buenas manos.</p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Prototipo funcional en entorno de demostración. Todos los mecánicos, usuarios, valoraciones, precios y verificaciones son
          ficticios. No se procesan pagos ni reservas reales. Los datos se guardan solo en este navegador.
        </p>
      </div>
    </footer>
  );
}

/** Restores the scroll position when going back or returning to a tab; new pages start at the top. */
function useScrollMemory() {
  const { pathname, state } = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Record<string, number>>({});
  const current = useRef(pathname);
  useEffect(() => {
    const onScroll = () => {
      positions.current[current.current] = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    current.current = pathname;
    const restore = navType === 'POP' || (state as { tab?: boolean } | null)?.tab;
    const top = restore ? (positions.current[pathname] ?? 0) : 0;
    requestAnimationFrame(() => window.scrollTo({ top }));
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { newRequestOpen, openNewRequest, closeNewRequest } = useNavUi();
  const user = useCurrentUser();
  const isPro = user?.role === 'mechanic';
  const mechanicItems = useMechanicNavItems();
  const tabHref = useTabMemory();
  const { pathname } = useLocation();
  useScrollMemory();
  const [condensed, expand] = useCondensedChrome();

  const focused = FOCUSED_ROUTES.some((r) => matchPath(r, pathname));
  const ownAction = OWN_ACTION_ROUTES.some((r) => matchPath(r, pathname));
  const showOwnerBar = !isPro && !focused && !ownAction;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-semibold">
        Saltar al contenido
      </a>
      <DemoBanner onSwitch={() => setSwitcherOpen(true)} />
      {isPro ? (
        <MechanicHeader items={mechanicItems} onSwitch={() => setSwitcherOpen(true)} />
      ) : (
        <OwnerHeader tabHref={tabHref} onNewRequest={openNewRequest} />
      )}
      <main id="main" className={cx('flex-1 md:pb-0', isPro ? 'pb-28' : showOwnerBar ? 'pb-32' : 'pb-10')}>
        {children ?? <Outlet />}
      </main>
      <Footer />
      {isPro ? <MechanicBottomTabs items={mechanicItems} /> : showOwnerBar && <OwnerBottomNav tabHref={tabHref} onNewRequest={openNewRequest} condensed={condensed} expand={expand} />}
      <Toaster />
      <AccountSwitcherDialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      {!isPro && (
        <NewRequestSheet open={newRequestOpen} onClose={closeNewRequest} />
      )}
    </div>
  );
}
