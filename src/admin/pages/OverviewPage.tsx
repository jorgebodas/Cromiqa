import { useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { listMechanics, listWaitlist } from '../api';
import { byZone, countSince, perDay } from '../lib';
import { DailyBars, StatTile, ZoneBars } from '../Charts';
import { useData } from '../useData';
import { MECHANIC_STATUSES } from '../types';
import { ErrorBox, PageTitle } from './shared';

export function OverviewPage() {
  const load = useCallback(async () => {
    const [waitlist, mechanics] = await Promise.all([listWaitlist(), listMechanics()]);
    return { waitlist, mechanics };
  }, []);
  const { data, error, loading, reload } = useData(load);

  return (
    <>
      <PageTitle title="Resumen" actions={<Button variant="secondary" size="sm" onClick={reload} icon={<RefreshCw className="size-4" aria-hidden />}>Actualizar</Button>} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Cargando métricas…" />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Lista de espera" value={data.waitlist.length} sub={`+${countSince(data.waitlist, 7)} en 7 días`} />
            <StatTile label="Mecánicos interesados" value={data.mechanics.length} sub={`+${countSince(data.mechanics, 7)} en 7 días`} />
            <StatTile label="Mecánicos nuevos" value={data.mechanics.filter((m) => m.status === 'new').length} sub="Sin contactar" />
            <StatTile label="Dados de alta" value={data.mechanics.filter((m) => m.status === 'onboarded').length} sub="Mecánicos" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DailyBars title="Lista de espera · últimos 30 días" data={perDay(data.waitlist, 30)} />
            <DailyBars title="Mecánicos · últimos 30 días" data={perDay(data.mechanics, 30)} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ZoneBars title="Lista de espera por zona" data={byZone(data.waitlist)} />
            <figure className="rounded-2xl border border-line bg-paper p-5">
              <figcaption className="font-semibold">Mecánicos por estado</figcaption>
              <ul className="mt-4 divide-y divide-line text-sm">
                {MECHANIC_STATUSES.map((s) => (
                  <li key={s.id} className="flex justify-between py-2">
                    <span>{s.label}</span>
                    <span className="tabular-nums font-medium">{data.mechanics.filter((m) => m.status === s.id).length}</span>
                  </li>
                ))}
              </ul>
            </figure>
          </div>
        </div>
      )}
    </>
  );
}
