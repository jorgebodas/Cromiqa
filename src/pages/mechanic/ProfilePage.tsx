import { Eye } from 'lucide-react';
import { BIKE_TYPES, LOCATIONS, SPECIALIZATIONS } from '@/domain/catalog';
import { useCurrentMechanic } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { Card, Field, FieldError, Input, LinkButton, PageHeader, Switch, Textarea, ToggleChip } from '@/components/ui';
import { useProfileEditor } from './useProfileEditor';
import { SaveBar } from './SaveBar';

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const { form, set, errors, saving, dirty, save, discard } = useProfileEditor(mechanic, [
    'headline',
    'bio',
    'yearsExperience',
    'specializations',
    'bikeTypes',
    'homeService',
    'workshop',
    'homeServiceFee',
    'serviceAreas',
    'workshopArea',
  ]);

  return (
    <div className="container-page max-w-3xl py-8 sm:py-10">
      <PageHeader
        eyebrow="Mi perfil"
        title={mechanic.businessName}
        description="Lo que edites aquí se refleja al instante en tu perfil público y en los resultados de búsqueda."
        actions={<LinkButton to={`/mecanicos/${mechanic.id}`} variant="secondary" icon={<Eye className="size-4" aria-hidden />}>Ver perfil público</LinkButton>}
      />

      <Card className="space-y-4 p-5">
        <h2 className="font-bold">Presentación</h2>
        <Field label="Especialidad principal" error={errors.headline} hint="Una línea. Aparece bajo tu nombre.">
          <Input name="headline" value={form.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Sobre ti" error={errors.bio} hint={`${form.bio.trim().length} caracteres · mínimo 30`}>
          <Textarea name="bio" rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={900} />
        </Field>
        <Field label="Años de experiencia" error={errors.yearsExperience}>
          <Input name="years" type="number" inputMode="numeric" min={0} max={60} value={form.yearsExperience} onChange={(e) => set({ yearsExperience: Number(e.target.value) })} className="max-w-32" />
        </Field>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <div>
          <h2 className="font-bold">Especialidades</h2>
          <p className="mb-3 text-sm text-muted">La primera que elijas se destaca en tu perfil.</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((s) => (
              <ToggleChip key={s.id} pressed={form.specializations.includes(s.id)} onToggle={() => set({ specializations: toggle(form.specializations, s.id) })}>
                {s.label}
              </ToggleChip>
            ))}
          </div>
          {errors.specializations && <div className="mt-2"><FieldError>{errors.specializations}</FieldError></div>}
        </div>
        <div>
          <h2 className="font-bold">Tipos de bici</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {BIKE_TYPES.map((t) => (
              <ToggleChip key={t.id} pressed={form.bikeTypes.includes(t.id)} onToggle={() => set({ bikeTypes: toggle(form.bikeTypes, t.id) })}>
                {t.label}
              </ToggleChip>
            ))}
          </div>
          {errors.bikeTypes && <div className="mt-2"><FieldError>{errors.bikeTypes}</FieldError></div>}
        </div>
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <h2 className="font-bold">Modalidad y zona de servicio</h2>
        <Switch checked={form.workshop} onChange={(workshop) => set({ workshop })} label="Trabajo en taller" description="Los clientes llevan la bici a tu taller." />
        {form.workshop && (
          <Field label="Zona del taller" hint="Indica solo la zona aproximada, nunca una dirección exacta en el perfil.">
            <Input name="workshop-area" value={form.workshopArea ?? ''} onChange={(e) => set({ workshopArea: e.target.value })} />
          </Field>
        )}
        <div className="border-t border-line pt-5">
          <Switch checked={form.homeService} onChange={(homeService) => set({ homeService })} label="Reparación a domicilio" description="Te desplazas a casa o al trabajo del cliente." />
        </div>
        {form.homeService && (
          <>
            <Field label="Suplemento por desplazamiento (€)" hint="0 si está incluido.">
              <Input name="home-fee" type="number" inputMode="numeric" min={0} value={form.homeServiceFee ?? 0} onChange={(e) => set({ homeServiceFee: Number(e.target.value) })} className="max-w-32" />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium">Zonas a las que te desplazas</p>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map((l) => (
                  <ToggleChip key={l.id} pressed={form.serviceAreas.includes(l.id)} onToggle={() => set({ serviceAreas: toggle(form.serviceAreas, l.id) })}>
                    {l.label}
                  </ToggleChip>
                ))}
              </div>
              {errors.serviceAreas && <div className="mt-2"><FieldError>{errors.serviceAreas}</FieldError></div>}
            </div>
          </>
        )}
        {errors.mode && <FieldError>{errors.mode}</FieldError>}
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}

export function ProfilePage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
