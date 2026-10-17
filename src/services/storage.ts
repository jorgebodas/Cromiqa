// Thin, failure-tolerant wrapper around LocalStorage (private mode / quota errors).
const memory = new Map<string, string>();
const quotaFailed = new Set<string>();

function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__cromiqa_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const storage = {
  getJSON<T>(key: string): T | null {
    try {
      const s = safeStorage();
      // The in-memory copy is only a fallback when LocalStorage is unavailable.
      const raw = s && !quotaFailed.has(key) ? s.getItem(key) : (memory.get(key) ?? null);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
      safeStorage()?.setItem(key, raw);
      quotaFailed.delete(key);
    } catch {
      quotaFailed.add(key);
      // Quota exceeded (e.g. many large photos): keep the in-memory copy.
      console.warn('[cromiqa] No se pudo guardar en LocalStorage; los cambios se mantienen solo en esta pestaña.');
    }
  },
  remove(key: string) {
    memory.delete(key);
    quotaFailed.delete(key);
    try {
      safeStorage()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
