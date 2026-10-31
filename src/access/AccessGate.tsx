// Private-preview gate. The public sees a "coming soon" page; testers open the prototype
// from the round button in the waitlist card ("Avísame") or the direct link #/entrar.
// GitHub Pages is static and this repo is public, so this is a curtain, not real
// security: it keeps casual visitors out, but the bundle is public (see README).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Checkbox, Dialog, Field, Input } from '@/components/ui';
import { ComingSoonPage } from '@/marketing/ComingSoonPage';
import { sha256Hex } from './sha256';
import { onOpenTesterLogin } from './testerLogin';

const SALT = 'cromiqa-gate-v1:';
// SHA-256 of SALT + password. Override at build time with VITE_ACCESS_HASH; set
// VITE_ACCESS_GATE=off to disable the gate. Never commit the password itself.
const DEFAULT_HASH = '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d';
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
    <Dialog open={open} onClose={onClose} title="Probar el prototipo" description="Introduce la contraseña de acceso que te hemos dado.">
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
    const off = onOpenTesterLogin(() => setLoginOpen(true));
    return () => {
      window.removeEventListener('hashchange', onHash);
      off();
    };
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
      <LoginDialog open={loginOpen} onClose={close} onUnlock={unlock} />
    </>
  );
}
