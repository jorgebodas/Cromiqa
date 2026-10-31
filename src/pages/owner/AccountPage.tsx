import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, LogOut, Repeat } from 'lucide-react';
import type { LocationId } from '@/domain/types';
import { LOCATIONS } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes, useRequestsFor } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { AccountSwitcherDialog, useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, Card, Field, Input, Select } from '@/components/ui';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function Inner() {
  const user = useCurrentUser()!;
  const updateUser = useApp((s) => s.updateUser);
  const toast = useApp((s) => s.toast);
  const bikes = useOwnerBikes(user.id);
  const requests = useRequestsFor({ ownerId: user.id });
  const switchAccount = useSwitchAccount();
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
      <ScreenHeader title="Cuenta" back="/" />
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
    <RoleGate role="owner" reason="Las cuentas de mecánico gestionan su perfil desde “Mi perfil”. Elige una cuenta de propietario para ver esta sección.">
      <Inner />
    </RoleGate>
  );
}
