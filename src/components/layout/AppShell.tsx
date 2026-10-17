import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bike,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Home,
  Inbox,
  LayoutDashboard,
  RefreshCw,
  Search,
  UserRound,
  Wrench,
} from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { useCurrentUser } from '@/state/selectors';
import { useApp } from '@/state/store';
import { Avatar, Toaster, cx } from '@/components/ui';
import { AccountSwitcherDialog } from './AccountSwitcher';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof Home;
  end?: boolean;
  badge?: number;
}

function useNavItems(): NavItem[] {
  const user = useCurrentUser();
  const requests = useApp((s) => s.db.requests);
  if (user?.role === 'mechanic') {
    const pending = requests.filter((r) => r.mechanicId === user.mechanicId && (r.status === 'sent' || r.status === 'awaiting_proposal')).length;
    return [
      { to: '/pro', label: 'Panel principal', short: 'Panel', icon: LayoutDashboard, end: true },
      { to: '/pro/solicitudes', label: 'Solicitudes', short: 'Solicitudes', icon: Inbox, badge: pending },
      { to: '/pro/servicios', label: 'Servicios', short: 'Servicios', icon: Wrench },
      { to: '/pro/disponibilidad', label: 'Disponibilidad', short: 'Agenda', icon: CalendarClock },
      { to: '/pro/perfil', label: 'Mi perfil', short: 'Perfil', icon: UserRound },
    ];
  }
  const proposals = user ? requests.filter((r) => r.ownerId === user.id && r.status === 'proposal_received').length : 0;
  return [
    { to: '/', label: 'Inicio', short: 'Inicio', icon: Home, end: true },
    { to: '/mecanicos', label: 'Encontrar mecánico', short: 'Buscar', icon: Search },
    { to: '/solicitudes', label: 'Mis solicitudes', short: 'Solicitudes', icon: ClipboardList, badge: proposals },
    { to: '/garaje', label: 'Mi garaje', short: 'Garaje', icon: Bike },
    { to: '/cuenta', label: 'Mi cuenta', short: 'Cuenta', icon: UserRound },
  ];
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

function Header({ items, onSwitch }: { items: NavItem[]; onSwitch: () => void }) {
  const user = useCurrentUser();
  const isPro = user?.role === 'mechanic';
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to={isPro ? '/pro' : '/'} className="flex items-center gap-2 rounded-md" aria-label="Cromiqa, inicio">
          <Wordmark className="text-[22px]" />
          {isPro && <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">Pro</span>}
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

function BottomTabs({ items }: { items: NavItem[] }) {
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

export function AppShell({ children }: { children?: ReactNode }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const items = useNavItems();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:font-semibold">
        Saltar al contenido
      </a>
      <DemoBanner onSwitch={() => setSwitcherOpen(true)} />
      <Header items={items} onSwitch={() => setSwitcherOpen(true)} />
      <main id="main" className="flex-1 pb-24 md:pb-0">
        {children ?? <Outlet />}
      </main>
      <Footer />
      <BottomTabs items={items} />
      <Toaster />
      <AccountSwitcherDialog open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
