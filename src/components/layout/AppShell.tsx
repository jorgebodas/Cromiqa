import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigationType } from 'react-router-dom';
import { ClipboardList, FlaskConical, Hammer, House, Inbox, Menu, Plus, RefreshCw, UserRound, Wrench } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { useCurrentUser } from '@/state/selectors';
import { useApp } from '@/state/store';
import { useOwnerActivity } from '@/state/activity';
import { useNavUi } from '@/state/ui';
import { Avatar, Toaster, cx } from '@/components/ui';
import { AccountSwitcherDialog } from './AccountSwitcher';
import { FloatingRequestHub, HeaderRequestChip, NewRequestPill, RequestHubOverlay, useHubItems, useReducedMotion } from '@/components/hub/RequestHub';
import type { HubItem } from '@/domain/logic/hub';
import { useMode, useModeStore } from '@/state/mode';
import { modeOfPath, type AppMode } from '@/domain/logic/modes';
import { ErrorBoundary } from './ErrorBoundary';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof House;
  end?: boolean;
  badge?: number;
}

/**
 * Mechanic mode: Inicio · Solicitudes · Servicios (no +). Profile, catalogue and availability
 * are reached from the avatar. The badge counts invitations still waiting for an answer.
 */
function useMechanicNavItems(): NavItem[] {
  const user = useCurrentUser();
  const requests = useApp((s) => s.db.requests);
  const pending = requests.filter((r) => r.mechanicId === user?.mechanicId && (r.status === 'sent' || r.status === 'awaiting_proposal')).length;
  return [
    { to: '/pro', label: 'Inicio', short: 'Inicio', icon: House, end: true },
    { to: '/pro/solicitudes', label: 'Solicitudes', short: 'Solicitudes', icon: Inbox, badge: pending },
    { to: '/pro/trabajos', label: 'Servicios', short: 'Servicios', icon: Hammer },
  ];
}

// ── Cyclist navigation ───────────────────────────────────────────────────────
// Three destinations (Inicio · Mecánicos · Solicitudes), one global action (+), and a header
// with the avatar (profile and mode) on the left, search and notifications on the right.
// The garage is secondary: reached from the profile and from a bike within a request.

interface OwnerTab {
  id: 'inicio' | 'mecanicos' | 'solicitudes';
  root: string;
  label: string;
  icon: typeof House;
  owns: (path: string) => boolean;
}

const OWNER_TABS: OwnerTab[] = [
  { id: 'inicio', root: '/', label: 'Inicio', icon: House, owns: (p) => p === '/' },
  { id: 'mecanicos', root: '/mecanicos', label: 'Mecánicos', icon: Wrench, owns: (p) => p === '/mecanicos' || p.startsWith('/mecanicos/') },
  { id: 'solicitudes', root: '/solicitudes', label: 'Solicitudes', icon: ClipboardList, owns: (p) => p === '/solicitudes' || p.startsWith('/solicitudes/') },
];

/** Focused flows hide the bottom bar and the + so nothing competes with finishing the task. */
const FOCUSED_ROUTES = ['/solicitar', '/pro/alta'];
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

/** The account (desktop header). Notifications live inside it: the badge counts unread updates. */
function AccountLink({ className, unread = 0 }: { className?: string; unread?: number }) {
  const user = useCurrentUser();
  return (
    <Link
      to="/cuenta"
      aria-label={unread ? `Tu perfil y notificaciones, ${unread} sin leer` : 'Tu perfil'}
      className={cx('relative flex size-12 items-center justify-center rounded-full md:size-10', className)}
      data-testid="account-link"
    >
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper ring-2 ring-paper" aria-hidden>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
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
  const { unread } = useOwnerActivity(user?.id);
  const { pathname } = useLocation();
  // Same rule as the phone dock: with active requests the Request Hub takes the place of
  // "Nueva solicitud", except inside Solicitudes, where the selected tab already says it all.
  const active = useHubItems().length > 0;
  const onRequests = OWNER_TABS.find((t) => t.id === 'solicitudes')!.owns(pathname);
  const tabs = OWNER_TABS;
  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-paper/90 backdrop-blur md:block">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to="/" className="rounded-md" aria-label="Cromiqa, inicio">
          <Wordmark className="text-[22px]" />
        </Link>
        <nav aria-label="Principal">
          <ul className="flex items-center gap-1">
            {tabs.map((t) => (
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
          {active ? (
            !onRequests && (
              <span className="mr-2">
                <HeaderRequestChip />
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={onNewRequest}
              className="ml-2 mr-2 flex h-10 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-semibold text-ink transition-colors hover:bg-lime-deep"
            >
              <Plus className="size-4" aria-hidden /> Nueva solicitud
            </button>
          )}
          <AccountLink unread={unread} />
        </div>
      </div>
    </header>
  );
}

const TAB_W = 56; // px per tab: the pill hugs its icons
const PILL_PAD = 4; // px around the tabs: the highlight sits close to the pill's edge

/**
 * The floating pill of the phone navigation: icons only, a white pill with a soft halo, and a
 * round highlight that slides to the active tab. Labels stay as accessible names.
 */
function FloatingTabs({ tabs, className, hidden }: { hidden?: boolean; tabs: { key: string; to: string; label: string; icon: typeof House; active: boolean; badge?: number; state?: unknown; appear?: boolean }[]; className?: string }) {
  const index = tabs.findIndex((t) => t.active);
  return (
    <nav aria-label="Principal (móvil)" className={cx('h-full', className)} style={{ padding: PILL_PAD }} {...(hidden ? { inert: '' } : {})}>
      <ul className="relative grid h-full w-max" style={{ gridTemplateColumns: `repeat(${tabs.length}, ${TAB_W}px)` }}>
        {index >= 0 && (
          <li
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(.3,1.25,.4,1)]"
            style={{ width: `${100 / tabs.length}%`, transform: `translateX(${index * 100}%)` }}
          >
            <span className="aspect-square h-full rounded-full bg-[#efefef]" />
          </li>
        )}
        {tabs.map((t) => (
          <li key={t.key} className={cx('relative', t.appear && 'opacity-0')}>
            <Link
              to={t.to}
              state={t.state}
              aria-label={t.badge ? `${t.label} (${t.badge} sin responder)` : t.label}
              aria-current={t.active ? 'page' : undefined}
              className={cx('flex h-full items-center justify-center rounded-full transition-colors', t.active ? 'text-[#3b3b3b]' : 'text-[#7a7a7a] hover:text-[#3b3b3b]')}
            >
              <span className="relative">
                <t.icon className="size-[26px]" strokeWidth={2} aria-hidden />
                {!!t.badge && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink ring-2 ring-paper" aria-hidden>
                    {t.badge}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const NAV_W = OWNER_TABS.length * TAB_W + PILL_PAD * 2;
/** The dock's transitions: restrained, no bounce. */
const MORPH_MS = 300;
const MORPH_EASE = 'cubic-bezier(.4,0,.2,1)';

/**
 * The phone dock: one white bar with the three tabs.
 *  · Outside Solicitudes, active requests: the Solicitudes tab stretches into a lime capsule,
 *    the Request Hub (its icon + message + "+N" + chevron), and the bar takes the full width.
 *  · Outside Solicitudes, nothing active: the bar hugs its tabs and a separate round + sits right.
 *  · Inside Solicitudes: just the tabs, Solicitudes selected.
 * The capsule grows out of the Solicitudes circle and shrinks back into it. Reduced motion: instant.
 */
function OwnerBottomNav({ tabHref, condensed, expand }: { tabHref: (t: OwnerTab) => string; condensed: boolean; expand: () => void }) {
  const { pathname } = useLocation();
  const items = useHubItems();
  const reduced = useReducedMotion();
  const onRequests = OWNER_TABS.find((t) => t.id === 'solicitudes')!.owns(pathname);
  const wantHub = !onRequests && items.length > 0 && !condensed;
  // The capsule stays mounted while it shrinks back into the tab.
  const [hubMounted, setHubMounted] = useState(wantHub);
  const lastItems = useRef<HubItem[]>(items);
  if (items.length) lastItems.current = items;
  const hubRef = useRef<HTMLButtonElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const showPlus = !onRequests && !items.length;

  useLayoutEffect(() => {
    if (wantHub) setHubMounted(true);
  }, [wantHub]);

  // The bar's width does the stretching (CSS); the capsule fades its lime and text in/out.
  useLayoutEffect(() => {
    const hub = hubRef.current;
    if (!hubMounted || !hub) return;
    const content = hub.querySelector<HTMLElement>('[data-hub-content]');
    if (reduced || typeof hub.animate !== 'function') {
      if (!wantHub) setHubMounted(false);
      return;
    }
    const opts = { duration: MORPH_MS, easing: MORPH_EASE, fill: 'both' as const };
    const anims: Animation[] = [];
    if (wantHub) {
      anims.push(hub.animate([{ backgroundColor: 'rgb(200 255 46 / 0)' }, { backgroundColor: 'rgb(200 255 46 / 1)', offset: 0.4 }, { backgroundColor: 'rgb(200 255 46 / 1)' }], opts));
      if (content) anims.push(content.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], opts));
      anims[0]!.onfinish = () => anims.forEach((x) => x.cancel());
    } else {
      if (content) anims.push(content.animate([{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }], opts));
      const fade = hub.animate([{ backgroundColor: 'rgb(200 255 46 / 1)' }, { backgroundColor: 'rgb(200 255 46 / 1)', offset: 0.6 }, { backgroundColor: 'rgb(200 255 46 / 0)' }], opts);
      anims.push(fade);
      fade.onfinish = () => setHubMounted(false);
    }
    return () => anims.forEach((x) => x.cancel());
  }, [wantHub, hubMounted, reduced]);

  // The + fades in when it appears.
  useLayoutEffect(() => {
    const plus = plusRef.current;
    if (!showPlus || !plus || reduced || typeof plus.animate !== 'function') return;
    const a = plus.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: MORPH_EASE });
    return () => a.cancel();
  }, [showPlus, reduced]);

  const width = condensed ? '64px' : wantHub ? '100%' : `${NAV_W}px`;
  const current = OWNER_TABS.find((t) => t.owns(pathname));
  const CurrentIcon = current?.icon ?? Menu;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <div className="relative mx-auto h-16 max-w-[380px]" data-testid="dock" data-state={wantHub ? 'hub' : showPlus ? 'new' : 'none'}>
        <div
          className="float-pill pointer-events-auto absolute left-0 top-0 h-16 overflow-hidden rounded-full transition-[width] ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none"
          style={{ width, maxWidth: '100%', transitionDuration: `${MORPH_MS}ms` }}
        >
          <FloatingTabs
            className={cx('transition-opacity duration-200', condensed ? 'opacity-0' : 'opacity-100')}
            tabs={OWNER_TABS.map((t) => ({ key: t.id, to: tabHref(t), label: t.label, icon: t.icon, active: t.owns(pathname), state: { tab: true } }))}
            hidden={condensed}
          />
          {/* The Request Hub: the Solicitudes tab, stretched (it covers that tab, from its circle to the bar's end). */}
          {hubMounted && (
            <FloatingRequestHub
              items={items.length ? items : lastItems.current}
              hubRef={hubRef}
              className="absolute bottom-1 right-1 top-1"
              style={{ left: PILL_PAD + 2 * TAB_W }}
            />
          )}
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
            <CurrentIcon className="size-[26px] text-[#3b3b3b]" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {showPlus && <NewRequestPill pillRef={plusRef} className="absolute right-0 top-0" />}
      </div>
    </div>
  );
}

function DemoBanner({ onSwitch }: { onSwitch: () => void }) {
  const user = useCurrentUser();
  const mode = useMode();
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
              {user && <span className="hidden sm:inline"> · {mode === 'mechanic' ? 'modo mecánico' : 'modo ciclista'}</span>}
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
function MechanicHeader({ items }: { items: NavItem[] }) {
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
        <AccountLink />
      </div>
    </header>
  );
}

function MechanicBottomTabs({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const isActive = (i: NavItem) => (i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + '/'));
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex items-center justify-center gap-3">
        <div className="float-pill pointer-events-auto h-16 rounded-full" style={{ width: items.length * TAB_W + PILL_PAD * 2 }}>
          <FloatingTabs tabs={items.map((i) => ({ key: i.to, to: i.to, label: i.label, icon: i.icon, active: isActive(i), badge: i.badge }))} />
        </div>
      </div>
    </div>
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

/** Each mode remembers the last place visited in it, so switching back returns there. */
function useRememberPlace(userId: string | undefined, mode: AppMode) {
  const { pathname, search } = useLocation();
  const remember = useModeStore((s) => s.remember);
  useEffect(() => {
    if (userId && modeOfPath(pathname) === mode) remember(userId, mode, pathname + search);
  }, [userId, mode, pathname, search, remember]);
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const openNewRequest = useNavUi((s) => s.openNewRequest);
  const user = useCurrentUser();
  const mode = useMode();
  const isPro = mode === 'mechanic';
  useRememberPlace(user?.id, mode);
  const mechanicItems = useMechanicNavItems();
  const tabHref = useTabMemory();
  const { pathname } = useLocation();
  useScrollMemory();
  const [condensed, expand] = useCondensedChrome();

  const focused = FOCUSED_ROUTES.some((r) => matchPath(r, pathname));
  const ownAction = OWN_ACTION_ROUTES.some((r) => matchPath(r, pathname));
  const showOwnerBar = !isPro && !focused && !ownAction;

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-semibold">
        Saltar al contenido
      </a>
      <DemoBanner onSwitch={() => setSwitcherOpen(true)} />
      {isPro ? (
        <MechanicHeader items={mechanicItems} />
      ) : (
        <OwnerHeader tabHref={tabHref} onNewRequest={openNewRequest} />
      )}
      <main id="main" className={cx('flex-1 md:pb-0', isPro ? 'pb-28' : showOwnerBar ? 'pb-32' : 'pb-10')}>
        <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
      </main>
      <Footer />
      {isPro ? <MechanicBottomTabs items={mechanicItems} /> : showOwnerBar && <OwnerBottomNav tabHref={tabHref} condensed={condensed} expand={expand} />}
      <Toaster />
      <AccountSwitcherDialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      {!isPro && (
        <>
          <RequestHubOverlay />
        </>
      )}
    </div>
  );
}
