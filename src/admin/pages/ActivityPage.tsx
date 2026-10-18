import { useCallback, useMemo, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button, EmptyState, Select, Spinner } from '@/components/ui';
import { listActivity, type ActivityEntry } from '../api';
import { useData } from '../useData';
import { statusLabel, type MechanicStatus } from '../types';
import { ErrorBox, PageTitle, fmtDateTime } from './shared';

const FIELD: Record<string, string> = { status: 'estado', notes: 'notas', name: 'nombre', email: 'email', zone: 'zona', phone: 'teléfono', workshop: 'taller', specialty: 'especialidad' };
const show = (field: string, v: unknown) => (field === 'status' ? statusLabel(v as MechanicStatus) : v === null || v === '' ? '—' : String(v));
const CONTENT: Record<string, string> = { benefits: 'los textos del carrusel', photos: 'las fotos del carrusel' };

/** One readable sentence per log entry. */
export function describe(e: ActivityEntry): string {
  const who = e.summary ?? e.entity_id ?? '';
  switch (`${e.entity}:${e.action}`) {
    case 'panel:sign_in':
      return 'Inició sesión en el panel';
    case 'panel:export_waitlist':
      return 'Exportó la lista de espera (CSV)';
    case 'panel:export_mechanics':
      return 'Exportó los mecánicos (CSV)';
    case 'waitlist_leads:delete':
      return `Eliminó ${who} de la lista de espera`;
    case 'mechanic_leads:delete':
      return `Eliminó al mecánico ${who}`;
    case 'site_content:insert':
    case 'site_content:update':
      return `Publicó ${CONTENT[e.entity_id ?? ''] ?? 'contenido'}`;
    case 'site_content:delete':
      return `Restableció ${CONTENT[e.entity_id ?? ''] ?? 'contenido'}`;
  }
  if (e.action === 'update') {
    const parts = Object.entries(e.details ?? {}).map(([field, { from, to }]) =>
      field === 'notes' ? 'editó las notas' : `cambió ${FIELD[field] ?? field}: ${show(field, from)} → ${show(field, to)}`,
    );
    const what = e.entity === 'mechanic_leads' ? `mecánico ${who}` : who;
    return parts.length ? `${what}: ${parts.join(', ')}`.replace(/^./, (c) => c.toUpperCase()) : `Actualizó ${what}`;
  }
  return `${e.action} · ${e.entity} ${who}`.trim();
}

const KINDS = [
  { id: '', label: 'Toda la actividad' },
  { id: 'panel', label: 'Accesos y exportaciones' },
  { id: 'mechanic_leads', label: 'Mecánicos' },
  { id: 'waitlist_leads', label: 'Lista de espera' },
  { id: 'site_content', label: 'Contenido' },
];

export function ActivityPage() {
  const load = useCallback(listActivity, []);
  const { data, error, loading, reload } = useData(load);
  const [kind, setKind] = useState('');
  const [actor, setActor] = useState('');
  const actors = useMemo(() => [...new Set((data ?? []).map((e) => e.actor ?? 'sistema'))].sort(), [data]);
  const rows = (data ?? []).filter((e) => (!kind || e.entity === kind) && (!actor || (e.actor ?? 'sistema') === actor));

  return (
    <>
      <PageTitle
        title="Actividad"
        description="Registro automático de lo que se hace en el panel. Solo lectura: no se puede editar ni borrar."
        actions={<Button variant="secondary" size="sm" onClick={reload} icon={<RefreshCw className="size-4" aria-hidden />}>Actualizar</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filtrar por tipo" className="sm:w-64">
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </Select>
        <Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Filtrar por persona" className="sm:w-64">
          <option value="">Todas las personas</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={<History className="size-6" />} title="Sin actividad todavía" description="Aquí aparecerán inicios de sesión, cambios de estado, notas, borrados, exportaciones y publicaciones." />
      ) : (
        <ol className="divide-y divide-line rounded-2xl border border-line bg-paper" data-testid="activity-list">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <time dateTime={e.at} className="w-44 shrink-0 text-xs text-muted tabular-nums">{fmtDateTime(e.at)}</time>
              <span className="min-w-0 flex-1 text-sm">{describe(e)}</span>
              <span className="truncate text-xs text-muted">{e.actor ?? 'sistema'}</span>
            </li>
          ))}
        </ol>
      )}
      {data && data.length >= 500 && <p className="mt-3 text-xs text-muted">Se muestran las 500 entradas más recientes.</p>}
    </>
  );
}
