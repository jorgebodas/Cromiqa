// Private-preview gate. The public sees a "coming soon" page; the prototype opens from a
// hidden hotspot (top-right corner) or the secret link #/entrar.
// GitHub Pages is static and this repo is public, so this is a curtain, not real
// security: it keeps casual visitors out, but the bundle is public (see README).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Checkbox, Dialog, Field, Input } from '@/components/ui';
import { ComingSoonPage } from '@/marketing/ComingSoonPage';
import { sha256Hex } from './sha256';

const SALT = 'cromiqa-gate-v1:';
// SHA-256 of SALT + password. Override at build time with VITE_ACCESS_HASH; set
// VITE_ACCESS_GATE=off to disable the gate. Never commit the password itself.
const DEFAULT_HASH = 'a4c7c39e9911444f184e4b3cbb271dfc46954288f89badfa62474431144684b3';
const HASH: string = import.meta.env.VITE_ACCESS_HASH || DEFAULT_HASH;
export const ACCESS_KEY = 'cromiqa:access';
const SECRET_ROUTE = '#/entrar';

export const gateEnabled = !import.meta.env.DEV && import.meta.env.VITE_ACCESS_GATE !== 'off';

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
  window.location.hash = '#/';
  window.location.reload();
}

function LoginDialog({ open, onClose, onUnlock }: { open: boolean; onClose: () => void; onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return setError('Escribe la contraseña.');
    setChecking(true);
    try {
      // Lowercase + trim: phone keyboards often capitalise or add a trailing space.
      const ok = (await sha256Hex(SALT + password.trim().toLowerCase())) === HASH;
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
      onUnlock();
    } catch {
      setError('No se pudo comprobar la contraseña. Recarga la página e inténtalo de nuevo.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Acceso privado" description="Solo para el equipo de Cromiqa.">
      <form onSubmit={submit} noValidate className="pb-2">
        <Field label="Contraseña" error={error}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
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
        <Button type="submit" variant="dark" size="lg" block className="mt-6" loading={checking}>
          Entrar
        </Button>
      </form>
    </Dialog>
  );
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => !gateEnabled || readUnlocked());
  const [loginOpen, setLoginOpen] = useState(() => window.location.hash.startsWith(SECRET_ROUTE));

  useEffect(() => {
    if (unlocked) return;
    const onHash = () => window.location.hash.startsWith(SECRET_ROUTE) && setLoginOpen(true);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [unlocked]);

  if (unlocked) return <>{children}</>;

  const close = () => {
    setLoginOpen(false);
    if (window.location.hash.startsWith(SECRET_ROUTE)) history.replaceState(null, '', window.location.pathname);
  };
  const unlock = () => {
    if (window.location.hash.startsWith(SECRET_ROUTE)) window.location.hash = '#/';
    setUnlocked(true);
  };

  return (
    <>
      <ComingSoonPage />
      {/* Hidden entrance: invisible 56px hotspot in the top-right corner. */}
      <button
        type="button"
        aria-label="Acceso del equipo"
        tabIndex={-1}
        onClick={() => setLoginOpen(true)}
        className="fixed right-0 top-0 z-40 size-14 cursor-default opacity-0"
        data-testid="hidden-login"
      />
      <LoginDialog open={loginOpen} onClose={close} onUnlock={unlock} />
    </>
  );
}
