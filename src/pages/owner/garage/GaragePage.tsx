import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike as BikeIcon, ChevronRight, Plus, Wrench } from 'lucide-react';
import type { Bike } from '@/domain/types';
import { bikeTypeLabel } from '@/domain/catalog';
import { formatDate } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useOwnerBikes } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { Button, EmptyState } from '@/components/ui';
import { BikeFormDialog } from './BikeForm';
import { ScreenHeader, headerButtonClass } from '@/components/layout/ScreenHeader';
import { OwnerQuickActions } from '@/components/layout/QuickActions';

export function BikePhoto({ bike, className = 'h-40' }: { bike: Bike; className?: string }) {
  return bike.photo ? (
    <img src={bike.photo} alt={`Foto de ${bike.name}`} className={`w-full rounded-2xl object-cover ${className}`} />
  ) : (
    <div className={`flex w-full items-center justify-center rounded-2xl bg-sand ${className}`} aria-hidden>
      <BikeIcon className="size-10 text-subtle" strokeWidth={1.25} />
    </div>
  );
}

function Inner() {
  const user = useCurrentUser()!;
  const bikes = useOwnerBikes(user.id);
  const maintenance = useApp((s) => s.db.maintenance);
  const addBike = useApp((s) => s.addBike);
  const toast = useApp((s) => s.toast);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <ScreenHeader
        title="Garaje"
        actions={
          <>
            <button type="button" onClick={() => setAdding(true)} aria-label="Añadir bici" className={headerButtonClass}>
              <Plus className="size-5" aria-hidden />
            </button>
            <OwnerQuickActions />
          </>
        }
      />
      <div className="container-page pb-8 sm:pb-10">
      {bikes.length === 0 ? (
        <EmptyState
          icon={<BikeIcon className="size-6" />}
          title="Tu garaje está vacío"
          description="Añade tu primera bici para llevar su historial y pedir servicios más rápido."
          action={<Button onClick={() => setAdding(true)}>Añadir bici</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bikes.map((b) => {
            const records = maintenance.filter((m) => m.bikeId === b.id).sort((x, y) => y.date.localeCompare(x.date));
            return (
              <li key={b.id}>
                <Link to={`/garaje/${b.id}`} className="surface group flex h-full flex-col p-4" data-testid="bike-card">
                  <BikePhoto bike={b} />
                  <div className="mt-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold">{b.name}</h2>
                      <p className="text-sm text-muted">
                        {b.brand} {b.model} · {bikeTypeLabel(b.type)}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm text-muted">
                    <Wrench className="size-4" aria-hidden />
                    {records.length
                      ? `${records.length} ${records.length === 1 ? 'registro' : 'registros'} · último ${formatDate(records[0]!.date, { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Sin mantenimientos registrados'}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <BikeFormDialog
          open
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            await addBike(input);
            toast(`${input.name} añadida a tu garaje`);
          }}
        />
      )}
      </div>
    </>
  );
}

export function GaragePage() {
  return (
    <RoleGate role="owner">
      <Inner />
    </RoleGate>
  );
}
