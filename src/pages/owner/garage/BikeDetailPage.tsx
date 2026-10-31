import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Bike as BikeIcon, ClipboardList, Pencil, Trash2, Wrench } from 'lucide-react';
import { bikeTypeLabel } from '@/domain/catalog';
import { formatDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { StatusBadge } from '@/components/domain/Status';
import { Button, Card, Dialog, EmptyState, KeyValue, LinkButton } from '@/components/ui';
import { BikeFormDialog } from './BikeForm';
import { BikePhoto } from './GaragePage';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function Inner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser()!;
  const bike = useApp((s) => s.db.bikes.find((b) => b.id === id && b.ownerId === user.id));
  const maintenance = useApp((s) => s.db.maintenance);
  const requests = useApp((s) => s.db.requests);
  const mechanics = useApp((s) => s.db.mechanics);
  const updateBike = useApp((s) => s.updateBike);
  const removeBike = useApp((s) => s.removeBike);
  const resetDraft = useApp((s) => s.resetDraft);
  const toast = useApp((s) => s.toast);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!bike) {
    return (
      <div className="container-page py-12">
        <EmptyState as="h1" icon={<BikeIcon className="size-6" />} title="Esta bici no está en tu garaje" action={<LinkButton to="/garaje" variant="dark">Volver al garaje</LinkButton>} />
      </div>
    );
  }

  const records = maintenance.filter((m) => m.bikeId === bike.id).sort((a, b) => b.date.localeCompare(a.date));
  const related = requests.filter((r) => r.bikeId === bike.id && r.status !== 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const mechanicName = (mid?: string) => mechanics.find((m) => m.id === mid)?.name;

  const requestService = () => {
    resetDraft({ bikeChoice: 'garage', bikeId: bike.id, bike: { type: bike.type, brand: '', model: '', name: '', notes: '' } });
    navigate(`/mecanicos?bici=${bike.type}`);
  };

  return (
    <>
      <ScreenHeader title={bike.name} back="/garaje" />
      <div className="container-page pb-8 sm:pb-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <BikePhoto bike={bike} className="h-56" />
          <p className="text-muted">
            {bike.brand} {bike.model}
          </p>
          <Card className="px-5 py-2">
            <dl className="divide-y divide-line">
              <KeyValue label="Tipo">{bikeTypeLabel(bike.type)}</KeyValue>
              {bike.year && <KeyValue label="Año">{bike.year}</KeyValue>}
              {bike.notes && <KeyValue label="Notas">{bike.notes}</KeyValue>}
            </dl>
          </Card>
          <Button block size="lg" onClick={requestService} icon={<ArrowRight className="order-last size-5" aria-hidden />}>
            Pedir un servicio para esta bici
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="danger" className="flex-1" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
              Eliminar
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-8">
          {related.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Solicitudes en marcha</h2>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/solicitudes/${r.id}`} className="surface flex items-center justify-between gap-3 p-4">
                      <span className="flex items-center gap-3">
                        <ClipboardList className="size-5 text-muted" aria-hidden />
                        <span>
                          <span className="block text-sm font-semibold">{r.code} · {mechanicName(r.mechanicId)}</span>
                          <span className="line-clamp-1 text-sm text-muted">{r.description}</span>
                        </span>
                      </span>
                      <StatusBadge status={r.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="history">
            <h2 id="history" className="mb-3 text-lg font-bold">Historial de mantenimiento</h2>
            {records.length === 0 ? (
              <EmptyState
                icon={<Wrench className="size-6" />}
                title="Sin registros todavía"
                description="Cuando un mecánico complete un servicio para esta bici, aparecerá aquí automáticamente."
              />
            ) : (
              <ol className="space-y-3" data-testid="maintenance-list">
                {records.map((m) => (
                  <li key={m.id} className="surface p-5" data-testid="maintenance-record">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted">{formatDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <h3 className="mt-0.5 font-bold">{m.title}</h3>
                      </div>
                      {m.cost !== undefined && <p className="font-semibold">{formatPrice(m.cost)}</p>}
                    </div>
                    <p className="mt-2 text-[15px]">{m.description}</p>
                    <p className="mt-3 text-sm text-muted">
                      {m.mechanicId ? <>Por {mechanicName(m.mechanicId)}</> : 'Registro manual'}
                      {m.requestId && (
                        <>
                          {' · '}
                          <Link to={`/solicitudes/${m.requestId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                            Ver solicitud
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {editing && (
        <BikeFormDialog
          open
          initial={bike}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            await updateBike(bike.id, input);
            toast('Cambios guardados');
          }}
        />
      )}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`¿Eliminar “${bike.name}”?`}
        description="Se borrará su historial de mantenimiento. Las solicitudes pasadas se conservan."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                await removeBike(bike.id);
                toast(`${bike.name} eliminada del garaje`);
                navigate('/garaje', { replace: true });
              }}
            >
              Eliminar bici
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Esta acción no se puede deshacer (salvo restableciendo la demo).</p>
      </Dialog>
      </div>
    </>
  );
}

export function BikeDetailPage() {
  return (
    <RoleGate role="owner">
      <Inner />
    </RoleGate>
  );
}
