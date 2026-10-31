import { useNavigate } from 'react-router-dom';
import { ChevronRight, RotateCcw } from 'lucide-react';
import type { ServiceCategory } from '@/domain/types';
import { categoryLabel } from '@/domain/catalog';
import { useApp } from '@/state/store';
import { useMechanic } from '@/state/selectors';
import { CATEGORY_ICONS, NEED_OPTIONS, useStartRequest } from '@/pages/owner/startRequest';
import { Dialog } from '@/components/ui';


/**
 * "Nueva solicitud", the one global action. Picking a need starts the existing request
 * flow: it seeds the draft and opens the mechanic search filtered by that service; choosing
 * a mechanic then continues in /solicitar with the category already selected.
 */
export function NewRequestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const draft = useApp((s) => s.draft);
  const startRequest = useStartRequest();
  const draftMechanic = useMechanic(draft.mechanicId);
  // A request already under way is offered first, so tapping + by accident never loses it.
  const inProgress = draftMechanic && (draft.step > 0 || draft.description.trim().length > 0);

  const start = (category: ServiceCategory) => {
    onClose();
    startRequest(category);
  };

  return (
    <Dialog open={open} onClose={onClose} title="¿Qué necesita tu bici?" description="Elige una opción y te mostramos los mecánicos que pueden ayudarte." sheet>
      {inProgress && (
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(`/solicitar?mecanico=${draftMechanic.id}`);
          }}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-ink bg-sand px-4 py-3 text-left"
        >
          <RotateCcw className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Continuar la solicitud en curso</span>
            <span className="block truncate text-xs text-muted">
              {draft.category ? `${categoryLabel(draft.category)} · ` : ''}con {draftMechanic.name}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      )}
      <ul className="space-y-2 pb-2" aria-label="Tipo de servicio">
        {NEED_OPTIONS.map((o) => {
          const Icon = CATEGORY_ICONS[o.id];
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => start(o.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left transition-colors hover:border-ink"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sand">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="flex-1 font-semibold">{o.label}</span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
