// Tester access to the prototype. GitHub Pages is static and the repo is public, so this is a
// curtain, not real security: it keeps casual visitors out, but the bundle is public (see README).
import { sha256Hex } from './sha256';

const SALT = 'cromiqa-gate-v1:';
// SHA-256 of SALT + password. Override at build time with VITE_ACCESS_HASH; set
// VITE_ACCESS_GATE=off to disable the gate. Never commit the password itself.
const DEFAULT_HASH = '66327b387c1d0b0049059ff0437b871d5bfebc1505a35e17c738f916c5aaa23d';
const HASH: string = import.meta.env.VITE_ACCESS_HASH || DEFAULT_HASH;
export const ACCESS_KEY = 'cromiqa:access';
export const SECRET_ROUTE = '#/entrar';

export const gateEnabled = !import.meta.env.DEV && import.meta.env.VITE_ACCESS_GATE !== 'off';

export function readUnlocked() {
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

/**
 * Checks the password (trimmed and lowercased: phone keyboards capitalise and add spaces) and,
 * if right, remembers this device and tells the gate to open. Throws if hashing fails.
 */
export async function unlockWithPassword(password: string, remember: boolean): Promise<boolean> {
  const ok = (await sha256Hex(SALT + password.trim().toLowerCase())) === HASH;
  if (!ok) return false;
  try {
    (remember ? localStorage : sessionStorage).setItem(ACCESS_KEY, HASH);
  } catch {
    /* private mode: unlocked for this page view only */
  }
  window.dispatchEvent(new Event(UNLOCKED));
  return true;
}

// Events between the coming-soon page (the dock) and the gate, to avoid an import cycle.
const OPEN = 'cromiqa:open-tester-login';
const UNLOCKED = 'cromiqa:unlocked';
const listen = (name: string, fn: () => void) => {
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
};
export const openTesterLogin = () => window.dispatchEvent(new Event(OPEN));
export const onOpenTesterLogin = (fn: () => void) => listen(OPEN, fn);
export const onUnlocked = (fn: () => void) => listen(UNLOCKED, fn);
