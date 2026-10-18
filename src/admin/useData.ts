import { useCallback, useEffect, useState } from 'react';

/** Loads data with loading/error states and a reload function. */
export function useData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, setData, error, loading, reload };
}
