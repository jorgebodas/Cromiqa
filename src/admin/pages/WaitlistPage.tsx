import { useCallback, useMemo, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import { Button, Dialog, EmptyState, IconButton, Input, Select, Spinner } from '@/components/ui';
import { useApp } from '@/state/store';
import { deleteWaitlist, listWaitlist, logEvent } from '../api';
import { byZone, downloadFile, matches, toCsv } from '../lib';
import { useData } from '../useData';
import type { WaitlistLead } from '../types';
import { ErrorBox, PageTitle, fmtDateTime } from './shared';

export function WaitlistPage() {
  const load = useCallback(listWaitlist, []);
  const { data, setData, error, loading, reload } = useData(load);
  const toast = useApp((s) => s.toast);
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('');
  const [toDelete, setToDelete] = useState<WaitlistLead | null>(null);
  const [busy, setBusy] = useState(false);

  const zones = useMemo(() => byZone(data ?? []).map((z) => z.zone), [data]);
  const rows = (data ?? []).filter((r) => matches(q, r.email, r.zone) && (!zone || (r.zone?.trim() || 'Sin indicar') === zone));

  const exportCsv = () => {
    void logEvent('export_waitlist');
    downloadFile(
      `cromiqa-lista-espera-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows as unknown as Record<string, unknown>[], [
        { key: 'email', label: 'Email' },
        { key: 'zone', label: 'Zona' },
        { key: 'source', label: 'Origen' },
        { key: 'created_at', label: 'Fecha de registro' },
      ]),
    );
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteWaitlist(toDelete.id);
      setData((d) => d?.filter((r) => r.id !== toDelete.id) ?? null);
      toast('Registro eliminado');
      setToDelete(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Lista de espera"
        description={data ? `${data.length} personas apuntadas` : undefined}
        actions={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length} icon={<Download className="size-4" aria-hidden />}>Exportar CSV</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" placeholder="Buscar email o zona" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" aria-label="Buscar" />
        </div>
        <Select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filtrar por zona" className="sm:w-56">
          <option value="">Todas las zonas</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </Select>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title={data?.length ? 'Nada coincide con la búsqueda' : 'Aún no hay nadie en la lista'} description={data?.length ? undefined : 'Los registros del botón “Avísame” aparecerán aquí.'} />
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[560px] text-left text-sm" data-testid="waitlist-table">
            <thead className="bg-sand text-xs uppercase tracking-wider text-muted">
              <tr><th scope="col" className="px-4 py-3 font-semibold">Email</th><th scope="col" className="px-4 py-3 font-semibold">Zona</th><th scope="col" className="px-4 py-3 font-semibold">Fecha</th><th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.email}</td>
                  <td className="px-4 py-3 text-muted">{r.zone || 'Sin indicar'}</td>
                  <td className="px-4 py-3 text-muted tabular-nums">{fmtDateTime(r.created_at)}</td>
                  <td className="px-2 py-1 text-right">
                    <IconButton label={`Eliminar ${r.email}`} onClick={() => setToDelete(r)} className="text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="¿Eliminar este registro?"
        description={`${toDelete?.email} dejará de estar en la lista. Úsalo, por ejemplo, si la persona pide que borremos sus datos.`}
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" loading={busy} onClick={confirmDelete}>Eliminar</Button></>}
      >
        <p className="text-sm text-muted">No se puede deshacer.</p>
      </Dialog>
    </>
  );
}
