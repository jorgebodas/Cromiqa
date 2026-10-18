import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Database, KeyRound, LogOut, ShieldAlert, Smartphone } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { supabaseConfigured } from '@/services/supabase';
import { Button, Card, Field, FieldError, Input, Toaster, cx } from '@/components/ui';
import { currentEmail, isAdmin, logEvent, mfaState, onAuthChange, signIn, signOut, startMfaEnrollment, verifyMfa } from './api';
import { OverviewPage } from './pages/OverviewPage';
import { WaitlistPage } from './pages/WaitlistPage';
import { MechanicsPage } from './pages/MechanicsPage';
import { ContentPage } from './pages/ContentPage';
import { ActivityPage } from './pages/ActivityPage';

const SECTIONS = [
  { hash: '#/admin', label: 'Resumen', Page: OverviewPage },
  { hash: '#/admin/espera', label: 'Lista de espera', Page: WaitlistPage },
  { hash: '#/admin/mecanicos', label: 'Mecánicos', Page: MechanicsPage },
  { hash: '#/admin/contenido', label: 'Contenido', Page: ContentPage },
  { hash: '#/admin/actividad', label: 'Actividad', Page: ActivityPage },
] as const;

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Wordmark className="text-2xl" />
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">Admin</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <Centered>
      <Card className="p-6">
        <Database className="size-6" aria-hidden />
        <h1 className="mt-4 text-xl font-extrabold">Conecta Supabase</h1>
        <p className="mt-2 text-sm text-muted">
          El panel necesita la base de datos. Crea el proyecto en Supabase, ejecuta <code>supabase/schema.sql</code> y añade la URL y la clave
          pública en <code>src/services/supabase.ts</code>. La guía completa está en el README, sección “Backend y panel de administración”.
        </p>
      </Card>
    </Centered>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Iniciar sesión</h1>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field label="Email">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} name="email" />
          </Field>
          <Field label="Contraseña">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} name="password" />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="dark" block size="lg" loading={busy}>
            Entrar
          </Button>
        </form>
      </Card>
    </Centered>
  );
}

/** 6-digit code input. Forwards the id/aria props that <Field> injects so the label is linked. */
function CodeInput({ value, onChange, ...aria }: { value: string; onChange: (v: string) => void; id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  return (
    <Input
      {...aria}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={7}
      placeholder="123 456"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ''))}
      className="text-center font-display text-2xl tracking-[0.3em]"
      name="code"
      autoFocus
    />
  );
}

function MfaVerify({ factorId, onDone, onCancel }: { factorId: string; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await verifyMfa(factorId, code);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <Card className="p-6">
        <KeyRound className="size-6" aria-hidden />
        <h1 className="mt-4 text-xl font-extrabold">Código de verificación</h1>
        <p className="mt-1 text-sm text-muted">Abre tu app de autenticación y escribe el código de 6 dígitos de Cromiqa.</p>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Field label="Código" error={error}>
            <CodeInput value={code} onChange={setCode} />
          </Field>
          <Button type="submit" variant="dark" block size="lg" loading={busy} disabled={code.replace(/\s/g, '').length !== 6}>
            Verificar
          </Button>
          <Button variant="ghost" block onClick={onCancel}>Cancelar</Button>
        </form>
      </Card>
    </Centered>
  );
}

function MfaEnroll({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    startMfaEnrollment().then(setSetup, (e) => setError(e instanceof Error ? e.message : 'No se pudo iniciar la configuración.'));
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError(undefined);
    try {
      await verifyMfa(setup.factorId, code);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Centered>
      <Card className="p-6">
        <Smartphone className="size-6" aria-hidden />
        <h1 className="mt-4 text-xl font-extrabold">Activa el doble factor</h1>
        <p className="mt-1 text-sm text-muted">
          Obligatorio para el panel. Escanea el código con Google Authenticator, 1Password, Authy o similar y escribe el código que te muestre.
        </p>
        {setup ? (
          <>
            <img src={setup.qr} alt="Código QR para tu app de autenticación" className="mx-auto mt-5 size-48 rounded-xl border border-line bg-paper p-2" />
            <p className="mt-3 text-center text-xs text-muted">
              ¿No puedes escanear? Introduce esta clave: <code className="select-all break-all font-semibold text-ink" data-testid="mfa-secret">{setup.secret}</code>
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <Field label="Código de la app" error={error}>
                <CodeInput value={code} onChange={setCode} />
              </Field>
              <Button type="submit" variant="dark" block size="lg" loading={busy} disabled={code.replace(/\s/g, '').length !== 6}>
                Activar y entrar
              </Button>
            </form>
          </>
        ) : error ? (
          <div className="mt-4"><FieldError>{error}</FieldError></div>
        ) : (
          <p className="mt-5 text-center text-sm text-muted">Preparando…</p>
        )}
        <Button variant="ghost" block className="mt-2" onClick={onCancel}>Cancelar</Button>
      </Card>
    </Centered>
  );
}

type AuthState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'mfa-enroll'; email: string }
  | { kind: 'mfa-verify'; email: string; factorId: string }
  | { kind: 'forbidden'; email: string }
  | { kind: 'admin'; email: string };

const SIGN_IN_LOGGED = 'cromiqa:admin:signin-logged';

export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ kind: 'loading' });
  const hash = useHash();

  const refresh = async () => {
    const email = await currentEmail();
    if (!email) return setAuth({ kind: 'signed-out' });
    // Two factors first: the database only grants admin rights to aal2 sessions.
    const mfa = await mfaState();
    if (mfa.kind === 'enroll') return setAuth({ kind: 'mfa-enroll', email });
    if (mfa.kind === 'verify') return setAuth({ kind: 'mfa-verify', email, factorId: mfa.factorId });
    if (!(await isAdmin())) return setAuth({ kind: 'forbidden', email });
    setAuth({ kind: 'admin', email });
    // Log one sign-in per browser session.
    try {
      if (!sessionStorage.getItem(SIGN_IN_LOGGED)) {
        sessionStorage.setItem(SIGN_IN_LOGGED, '1');
        void logEvent('sign_in');
      }
    } catch {
      /* ignore */
    }
  };
  const logout = () => {
    try {
      sessionStorage.removeItem(SIGN_IN_LOGGED);
    } catch {
      /* ignore */
    }
    void signOut().then(refresh);
  };

  useEffect(() => {
    document.title = 'Cromiqa · Admin';
    if (!supabaseConfigured) return;
    void refresh();
    return onAuthChange(() => void refresh());
  }, []);

  if (!supabaseConfigured) return <NotConfigured />;
  if (auth.kind === 'loading') return <Centered><p className="text-center text-sm text-muted">Cargando…</p></Centered>;
  if (auth.kind === 'signed-out') return <Login onDone={refresh} />;
  if (auth.kind === 'mfa-enroll') return <MfaEnroll onDone={refresh} onCancel={logout} />;
  if (auth.kind === 'mfa-verify') return <MfaVerify factorId={auth.factorId} onDone={refresh} onCancel={logout} />;
  if (auth.kind === 'forbidden') {
    return (
      <Centered>
        <Card className="p-6">
          <ShieldAlert className="size-6" aria-hidden />
          <h1 className="mt-4 text-xl font-extrabold">Sin acceso</h1>
          <p className="mt-2 text-sm text-muted">
            {auth.email} no está en la lista de administradores. Añádelo en la tabla <code>admins</code> de Supabase.
          </p>
          <Button variant="secondary" className="mt-5" onClick={logout}>
            Cerrar sesión
          </Button>
        </Card>
      </Centered>
    );
  }

  const section = SECTIONS.find((s) => s.hash === hash.split('?')[0]) ?? SECTIONS[0];
  const Page = section.Page;
  return (
    <div className="min-h-dvh bg-sand/50">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#/admin" className="flex items-center gap-2" aria-label="Panel de administración, resumen">
            <Wordmark className="text-xl" />
            <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-paper">Admin</span>
          </a>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{auth.email}</span>
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="size-4" aria-hidden />}>
              Salir
            </Button>
          </div>
        </div>
        <nav aria-label="Secciones" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <li key={s.hash}>
                <a
                  href={s.hash}
                  aria-current={s === section ? 'page' : undefined}
                  className={cx(
                    'block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-[color]',
                    s === section ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Page />
      </main>
      <Toaster />
    </div>
  );
}
