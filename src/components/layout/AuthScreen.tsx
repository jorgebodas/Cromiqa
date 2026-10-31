import { useState, type FormEvent } from 'react';
import { FlaskConical } from 'lucide-react';
import type { LocationId } from '@/domain/types';
import { LOCATIONS } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { Button, Field, FieldError, Input, Select, cx } from '@/components/ui';
import { Wordmark } from '@/brand/Wordmark';

/**
 * Shared test world: each tester signs in with their own account, so what one does reaches the
 * others' phones. New testers create a cyclist account; mechanic test accounts are created by
 * the team (they can also become mechanics from Perfil → Hazte mecánico).
 */
export function AuthScreen() {
  const signIn = useApp((s) => s.signIn);
  const signUp = useApp((s) => s.signUp);
  const sharedError = useApp((s) => s.sharedError);
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState<LocationId>('madrid-centro');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setInfo(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un email válido.');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (tab === 'up' && name.trim().length < 2) return setError('Escribe tu nombre.');
    setBusy(true);
    try {
      if (tab === 'in') await signIn(email, password);
      else if (!(await signUp(email, password, { name: name.trim(), location }))) {
        setInfo('Cuenta creada. Te hemos enviado un email para confirmarla; después, entra aquí con tu contraseña.');
        setTab('in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark className="text-[26px]" />
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
          <FlaskConical className="size-3.5 text-lime" aria-hidden /> Prueba compartida
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{tab === 'in' ? 'Entra en Cromiqa' : 'Crea tu cuenta'}</h1>
        <p className="mt-2 text-[15px] text-muted">
          Cada persona usa su cuenta: lo que haces llega en directo a los demás probadores. Los datos son de prueba.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1" role="tablist" aria-label="Acceso">
          {(
            [
              ['in', 'Entrar'],
              ['up', 'Crear cuenta'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => (setTab(id), setError(undefined))}
              className={cx('h-10 rounded-full text-sm font-semibold transition-colors', tab === id ? 'bg-paper shadow-[var(--shadow-surface)]' : 'text-muted')}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          {tab === 'up' && (
            <>
              <Field label="Tu nombre">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Tu zona">
                <Select value={location} onChange={(e) => setLocation(e.target.value as LocationId)}>
                  {LOCATIONS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          <Field label="Email">
            <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña" hint={tab === 'up' ? 'Al menos 6 caracteres.' : undefined}>
            <Input type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {(error || sharedError) && <FieldError>{error ?? sharedError}</FieldError>}
          {info && (
            <p role="status" className="rounded-2xl bg-canvas p-3 text-sm">
              {info}
            </p>
          )}
          <Button type="submit" size="lg" block loading={busy}>
            {tab === 'in' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>
      </div>
    </div>
  );
}
