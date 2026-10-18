import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Download, Mail, Phone, Search, Trash2 } from 'lucide-react';
import { Button, Dialog, EmptyState, Input, Select, Spinner, Textarea, cx } from '@/components/ui';
import { useApp } from '@/state/store';
import { deleteMechanic, listMechanics, logEvent, updateMechanic } from '../api';
import { downloadFile, matches, toCsv } from '../lib';
import { useData } from '../useData';
import { MECHANIC_STATUSES, statusLabel, type MechanicLead, type MechanicStatus } from '../types';
import { ErrorBox, PageTitle, fmtDateTime } from './shared';

const STATUS_STYLE: Record<MechanicStatus, string> = {
  new: 'bg-lime text-ink',
  contacted: 'bg-sand text-ink',
  talking: 'bg-sand-deep text-ink',
  onboarded: 'bg-ink text-paper',
  discarded: 'bg-paper text-muted border border-line-strong',
};

function MechanicRow({ m, onChange, onDelete }: { m: MechanicLead; onChange: (patch: Partial<MechanicLead>) => void; onDelete: () => void }) {
  const toast = useApp((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(m.notes);
  const [saving, setSaving] = useState(false);
  useEffect(() => setNotes(m.notes), [m.notes]);

  const save = async (patch: { status?: MechanicStatus; notes?: string }, message: string) => {
    setSaving(true);
    try {
      await updateMechanic(m.id, patch);
      onChange(patch);
      toast(message);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-paper" data-testid="mechanic-row">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{m.name}{m.workshop ? <span className="font-normal text-muted"> · {m.workshop}</span> : null}</span>
            <span className="block truncate text-sm text-muted">{m.zone || 'Sin zona'} · {fmtDateTime(m.created_at)}</span>
          </span>
        </button>
        <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[m.status])}>{statusLabel(m.status)}</span>
        <Select
          aria-label={`Estado de ${m.name}`}
          value={m.status}
          disabled={saving}
          onChange={(e) => void save({ status: e.target.value as MechanicStatus }, `Estado: ${statusLabel(e.target.value as MechanicStatus)}`)}
          className="h-10 w-44"
        >
          {MECHANIC_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-line p-4 sm:grid-cols-2">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="size-4 text-muted" aria-hidden /><a className="underline-offset-2 hover:underline" href={`mailto:${m.email}`}>{m.email}</a></div>
            <div className="flex items-center gap-2"><Phone className="size-4 text-muted" aria-hidden />{m.phone ? <a className="underline-offset-2 hover:underline" href={`tel:${m.phone}`}>{m.phone}</a> : <span className="text-muted">Sin teléfono</span>}</div>
            <div><dt className="text-muted">Especialidad</dt><dd>{m.specialty || '—'}</dd></div>
            <div><dt className="text-muted">Actualizado</dt><dd className="tabular-nums">{fmtDateTime(m.updated_at)}</dd></div>
          </dl>
          <div>
            <label htmlFor={`notes-${m.id}`} className="text-sm font-medium">Notas internas</label>
            <Textarea id={`notes-${m.id}`} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Llamada, condiciones, próximos pasos…" className="mt-1.5" maxLength={4000} />
            <div className="mt-2 flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 className="size-4" aria-hidden />} className="text-danger">Eliminar</Button>
              <Button variant="dark" size="sm" disabled={notes === m.notes} loading={saving} onClick={() => void save({ notes }, 'Notas guardadas')}>Guardar notas</Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function MechanicsPage() {
  const load = useCallback(listMechanics, []);
  const { data, setData, error, loading, reload } = useData(load);
  const toast = useApp((s) => s.toast);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<MechanicStatus | ''>('');
  const [toDelete, setToDelete] = useState<MechanicLead | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = (data ?? []).filter((m) => matches(q, m.name, m.workshop, m.email, m.zone, m.specialty) && (!status || m.status === status));
  const patch = (id: string, p: Partial<MechanicLead>) => setData((d) => d?.map((m) => (m.id === id ? { ...m, ...p } : m)) ?? null);

  const exportCsv = () => {
    void logEvent('export_mechanics');
    downloadFile(
      `cromiqa-mecanicos-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows.map((m) => ({ ...m, status: statusLabel(m.status) })) as unknown as Record<string, unknown>[], [
        { key: 'name', label: 'Nombre' },
        { key: 'workshop', label: 'Taller' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Teléfono' },
        { key: 'zone', label: 'Zona' },
        { key: 'specialty', label: 'Especialidad' },
        { key: 'status', label: 'Estado' },
        { key: 'notes', label: 'Notas' },
        { key: 'created_at', label: 'Fecha de registro' },
      ]),
    );
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteMechanic(toDelete.id);
      setData((d) => d?.filter((m) => m.id !== toDelete.id) ?? null);
      toast('Mecánico eliminado');
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
        title="Mecánicos y talleres"
        description={data ? `${data.length} interesados · ${data.filter((m) => m.status === 'new').length} sin contactar` : undefined}
        actions={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length} icon={<Download className="size-4" aria-hidden />}>Exportar CSV</Button>}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" placeholder="Buscar nombre, taller, email, zona…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" aria-label="Buscar" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as MechanicStatus | '')} aria-label="Filtrar por estado" className="sm:w-56">
          <option value="">Todos los estados</option>
          {MECHANIC_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title={data?.length ? 'Nada coincide con la búsqueda' : 'Aún no hay mecánicos'} description={data?.length ? undefined : 'Los registros de “Soy mecánico” aparecerán aquí.'} />
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => <MechanicRow key={m.id} m={m} onChange={(p) => patch(m.id, p)} onDelete={() => setToDelete(m)} />)}
        </ul>
      )}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="¿Eliminar este mecánico?"
        description={`Se borrarán los datos y las notas de ${toDelete?.name}.`}
        footer={<><Button variant="ghost" onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" loading={busy} onClick={confirmDelete}>Eliminar</Button></>}
      >
        <p className="text-sm text-muted">No se puede deshacer.</p>
      </Dialog>
    </>
  );
}
