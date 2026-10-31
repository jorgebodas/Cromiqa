import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bike, CalendarClock, ChevronRight, Eye, FlaskConical, LogOut, Repeat, Tag, UserRoundCog, Wrench } from 'lucide-react';
import type { LocationId } from '@/domain/types';
import { LOCATIONS } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { useMode } from '@/state/mode';
import { canSwitchMode, type AppMode } from '@/domain/logic/modes';
import { AccountSwitcherDialog, useSwitchAccount, useSwitchMode } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, Card, Field, Input, Select, cx } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function LinkRow({ to, icon: Icon, label, detail }: { to: string; icon: typeof Bike; label: string; detail?: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas/60">
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}

/** Two-way switch between the account's modes. Only shown when the account has both. */
function ModeSwitch({ mode }: { mode: AppMode }) {
  const switchMode = useSwitchMode();
  const options: { id: AppMode; label: string; icon: typeof Bike }[] = [
    { id: 'cyclist', label: 'Ciclista', icon: Bike },
    { id: 'mechanic', label: 'Mecánico', icon: Wrench },
  ];
  return (
    <div role="radiogroup" aria-label="Modo de uso" className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          onClick={() => mode !== o.id && switchMode(o.id)}
          className={cx(
            'flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors',
            mode === o.id ? 'bg-paper shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          <o.icon className="size-4" aria-hidden /> {o.label}
        </button>
      ))}
    </div>
  );
}

function Inner() {
  const user = useCurrentUser()!;
  const updateUser = useApp((s) => s.updateUser);
  const toast = useApp((s) => s.toast);
  const bikes = useOwnerBikes(user.id);
  const requests = useRequestsFor({ ownerId: user.id });
  const switchAccount = useSwitchAccount();
  const mode = useMode();
  const mechanic = useApp((s) => s.db.mechanics.find((m) => m.id === user.mechanicId));
  const [name, setName] = useState(user.name);
  const [location, setLocation] = useState<LocationId>(user.location);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const dirty = name !== user.name || location !== user.location;

  const save = async () => {
    if (name.trim().length < 2) return setError('Escribe tu nombre.');
    setError(undefined);
    setSaving(true);
    try {
      await updateUser({ name: name.trim(), location });
      toast('Datos actualizados');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Perfil" back={mode === 'mechanic' ? '/pro' : '/'} />
      <div className="container-page max-w-3xl pb-8 sm:pb-10">
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="text-lg font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="mt-1 text-sm text-muted">
            {bikes.length} {bikes.length === 1 ? 'bici' : 'bicis'} · {requests.length} {requests.length === 1 ? 'solicitud' : 'solicitudes'}
          </p>
        </div>
      </Card>

      {/* Mode: switch here, not from a permanent header toggle. */}
      <Card className="mt-4 p-5" data-testid="mode-card">
        <h2 className="font-bold">Modo</h2>
        {canSwitchMode(user) ? (
          <>
            <p className="mb-3 mt-1 text-sm text-muted">Tu cuenta tiene los dos modos. Cada uno recuerda dónde lo dejaste.</p>
            <ModeSwitch mode={mode} />
          </>
        ) : (
          <div className="mt-2 flex items-start gap-3">
            <UserRoundCog className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
            <p className="text-sm text-muted">
              Usas Cromiqa como ciclista. El modo mecánico se activa al crear un perfil profesional; el alta de profesionales llegará próximamente.
            </p>
          </div>
        )}
      </Card>

      {mode === 'cyclist' ? (
        <ul className="surface mt-4 divide-y divide-line overflow-hidden" aria-label="Tu actividad">
          <LinkRow to="/garaje" icon={Bike} label="Garaje" detail={`${bikes.length} ${bikes.length === 1 ? 'bici' : 'bicis'} y su historial`} />
          <LinkRow to="/actividad" icon={Bell} label="Notificaciones" />
        </ul>
      ) : (
        mechanic && (
          <ul className="surface mt-4 divide-y divide-line overflow-hidden" aria-label="Tu perfil profesional">
            <LinkRow to="/pro/perfil" icon={UserRoundCog} label="Perfil profesional" detail={mechanic.businessName} />
            <LinkRow to="/pro/servicios" icon={Tag} label="Servicios y tarifas" detail={`${mechanic.services.length} publicados`} />
            <LinkRow to="/pro/disponibilidad" icon={CalendarClock} label="Disponibilidad y cobertura" detail={mechanic.availabilityNote} />
            <LinkRow to={`/mecanicos/${mechanic.id}`} icon={Eye} label="Ver perfil público" />
          </ul>
        )
      )}

      <Card className="mt-4 space-y-4 p-5">
        <h2 className="font-bold">Datos personales</h2>
        <Field label="Nombre" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} name="name" autoComplete="name" />
        </Field>
        <Field label="Email" hint="Email ficticio del entorno de demostración. No se envía ningún correo.">
          <Input value={user.email} readOnly disabled name="email" />
        </Field>
        <Field label="Zona habitual" hint="La usamos para preseleccionar tu zona al buscar.">
          <Select value={location} onChange={(e) => setLocation(e.target.value as LocationId)} name="location">
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty} loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <FlaskConical className="size-4" aria-hidden /> Entorno de demostración
        </h2>
        <p className="mt-1 text-sm text-muted">
          No hay autenticación real. Puedes cambiar de cuenta al instante o restablecer los datos desde el{' '}
          <Link to="/demo" className="font-medium text-ink underline">panel demo</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="dark" size="sm" icon={<Repeat className="size-4" aria-hidden />} onClick={() => setSwitcher(true)}>
            Cambiar de cuenta
          </Button>
          <Button variant="secondary" size="sm" icon={<LogOut className="size-4" aria-hidden />} onClick={() => switchAccount(null, { to: '/' })}>
            Salir (navegar como invitado)
          </Button>
        </div>
      </Card>
      <AccountSwitcherDialog open={switcher} onClose={() => setSwitcher(false)} />
      </div>
    </>
  );
}

export function AccountPage() {
  return (
    <RoleGate reason="Elige una cuenta de demostración para ver tu perfil.">
      <Inner />
    </RoleGate>
  );
}
