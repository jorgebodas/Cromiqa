// Private-preview gate. GitHub Pages is static and this repo is public, so this is a
// curtain, not real security: it keeps casual visitors out, but the bundle is public.
// For real access control put the domain behind an identity proxy (see README).
import { useState, type FormEvent, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { Button, Checkbox, Field, Input } from '@/components/ui';

const SALT = 'cromiqa-gate-v1:';
// SHA-256 of SALT + password. Override at build time with VITE_ACCESS_HASH; set
// VITE_ACCESS_GATE=off to disable the gate. Never commit the password itself.
const DEFAULT_HASH = 'f3e8217e50e7dab64ebd5b8438a2eaec49498479bdaf690fa665ea5d779a1783';
const HASH: string = import.meta.env.VITE_ACCESS_HASH || DEFAULT_HASH;
export const ACCESS_KEY = 'cromiqa:access';

export const gateEnabled = !import.meta.env.DEV && import.meta.env.VITE_ACCESS_GATE !== 'off';

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readUnlocked() {
  try {
    // Storing the hash means changing the password locks every device again.
    return localStorage.getItem(ACCESS_KEY) === HASH || sessionStorage.getItem(ACCESS_KEY) === HASH;
  } catch {
    return false;
  }
}

export function lockDevice() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => !gateEnabled || readUnlocked());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError('Escribe la contraseña.');
    setChecking(true);
    const ok = (await sha256(SALT + password.trim())) === HASH;
    setChecking(false);
    if (!ok) {
      setError('Contraseña incorrecta.');
      setPassword('');
      return;
    }
    try {
      (remember ? localStorage : sessionStorage).setItem(ACCESS_KEY, HASH);
    } catch {
      /* private mode: unlocked for this page view only */
    }
    setUnlocked(true);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sand px-4 py-10">
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-3xl border border-line bg-paper p-6 shadow-card sm:p-8">
        <Wordmark className="text-2xl" />
        <div className="mt-8 flex size-12 items-center justify-center rounded-2xl bg-sand" aria-hidden>
          <Lock className="size-5" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Acceso privado</h1>
        <p className="mt-1 text-[15px] text-muted">Cromiqa está en construcción. Introduce la contraseña para continuar.</p>
        <Field label="Contraseña" error={error} className="mt-6">
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
        </Field>
        <div className="mt-4">
          <Checkbox checked={remember} onChange={setRemember} label="Recordar este dispositivo" />
        </div>
        <Button type="submit" size="lg" block className="mt-6" loading={checking}>
          Entrar
        </Button>
      </form>
    </main>
  );
}
