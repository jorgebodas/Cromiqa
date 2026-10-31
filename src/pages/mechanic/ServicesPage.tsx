import { Plus, Trash2 } from 'lucide-react';
import type { MechanicService, ServiceCategory } from '@/domain/types';
import { CATEGORIES } from '@/domain/catalog';
import { uid } from '@/domain/utils';
import { useCurrentMechanic } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { Field, FieldError, IconButton, Input, Select, Textarea } from '@/components/ui';
import { useProfileEditor } from './useProfileEditor';
import { SaveBar } from './SaveBar';
import { ScreenHeader, headerButtonClass } from '@/components/layout/ScreenHeader';

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const { form, set, errors, saving, dirty, save, discard } = useProfileEditor(mechanic, ['services']);
  const update = (id: string, patch: Partial<MechanicService>) => set({ services: form.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const add = () =>
    set({ services: [...form.services, { id: uid('svc'), category: 'repair', name: '', description: '', priceFrom: undefined }] });
  const remove = (id: string) => set({ services: form.services.filter((s) => s.id !== id) });

  return (
    <>
      <ScreenHeader
        title="Servicios"
        description="Los precios son orientativos («desde»). El precio final lo fijas en cada propuesta."
        actions={
          <button type="button" onClick={add} aria-label="Añadir servicio" className={headerButtonClass}>
            <Plus className="size-5" aria-hidden />
          </button>
        }
      />
      <div className="container-page max-w-3xl pb-8 sm:pb-10">
      {errors.services && <div className="mb-4"><FieldError>{errors.services}</FieldError></div>}
      <ul className="space-y-3">
        {form.services.map((s, i) => (
          <li key={s.id} className="rounded-2xl border border-line p-4 sm:p-5" data-testid="service-row">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
              <Field label="Nombre del servicio" error={errors[`service-${i}`]}>
                <Input name={`service-name-${i}`} value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} />
              </Field>
              <Field label="Categoría">
                <Select value={s.category} onChange={(e) => update(s.id, { category: e.target.value as ServiceCategory })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Descripción" className="mt-4" optional>
              <Textarea rows={2} value={s.description} onChange={(e) => update(s.id, { description: e.target.value })} />
            </Field>
            <div className="mt-4 flex items-end gap-4">
              <Field label="Precio desde (€)" hint="Vacío = a consultar" className="w-40">
                <Input
                  name={`service-price-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={s.priceFrom ?? ''}
                  onChange={(e) => update(s.id, { priceFrom: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </Field>
              <Field label="Duración (min)" optional className="w-36">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={s.durationMinutes ?? ''}
                  onChange={(e) => update(s.id, { durationMinutes: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </Field>
              <div className="ml-auto pb-1">
                <IconButton label={`Eliminar ${s.name || 'servicio'}`} onClick={() => remove(s.id)} className="text-danger hover:bg-danger-soft">
                  <Trash2 className="size-5" />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
      </div>
    </>
  );
}

export function ServicesPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
