import type { ReactNode } from 'react';
import { Bike as BikeIcon, CalendarDays, Home, Pencil, Plus, Store } from 'lucide-react';
import type { Bike, Mechanic, User } from '@/domain/types';
import {
  BIKE_TYPES,
  CATEGORIES,
  LOCATIONS,
  TIME_SLOTS,
  bikeTypeLabel,
  categoryLabel,
  locationLabel,
  modeLabel,
  slotLabel,
} from '@/domain/catalog';
import { formatLongDate, formatPrice, toISODate } from '@/domain/utils';
import type { RequestDraft } from '@/state/store';
import { Avatar, Checkbox, ChoiceCard, Field, FieldError, Input, Select, Textarea, ToggleChip, cx } from '@/components/ui';
import { CATEGORY_ICONS } from '../HomePage';
import type { DraftErrors } from './draftValidation';

interface StepProps {
  draft: RequestDraft;
  set: (patch: Partial<RequestDraft>) => void;
  mechanic: Mechanic;
  errors: DraftErrors;
}

const DESCRIPTION_HINTS: Record<string, string> = {
  repair: 'Qué falla, desde cuándo y cuándo lo notas (al frenar, al cambiar, en subida…).',
  maintenance: 'Cuándo fue la última revisión y si hay algo que te preocupe en especial.',
  inspection: 'Qué bici es, dónde está y qué te ha contado el vendedor.',
  diagnosis: 'Describe lo que notas: ruidos, vibraciones, holguras… Con tus palabras.',
};

export function StepProblem({ draft, set, mechanic, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">Tipo de servicio</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" id="field-category" tabIndex={-1}>
          {CATEGORIES.map((c) => {
            const offered = mechanic.services.some((s) => s.category === c.id);
            const Icon = CATEGORY_ICONS[c.id];
            return (
              <ChoiceCard
                key={c.id}
                name="category"
                value={c.id}
                selected={draft.category === c.id}
                onSelect={() => set({ category: c.id })}
                disabled={!offered}
                icon={<Icon className="size-5" />}
                title={c.label}
                description={offered ? c.description : `${mechanic.name.split(' ')[0]} no ofrece este servicio.`}
              />
            );
          })}
        </div>
        {errors.category && <div className="mt-2"><FieldError>{errors.category}</FieldError></div>}
      </fieldset>
      <Field
        label="Describe el problema"
        hint={(draft.category && DESCRIPTION_HINTS[draft.category]) || 'Cuéntalo con tus palabras.'}
        error={errors.description}
      >
        <Textarea
          name="description"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={5}
          maxLength={1000}
          placeholder="Ej.: los cambios saltan al subir y la cadena hace ruido en los piñones grandes."
        />
      </Field>
    </div>
  );
}

function BikeTypePicker({ value, onChange, mechanic, error }: { value?: Bike['type']; onChange: (t: Bike['type']) => void; mechanic: Mechanic; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Tipo de bici</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" id="field-type" tabIndex={-1} role="radiogroup">
        {BIKE_TYPES.map((t) => {
          const supported = mechanic.bikeTypes.includes(t.id);
          return (
            <label
              key={t.id}
              className={cx(
                'flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
                value === t.id ? 'border-ink bg-ink text-paper' : 'border-line-strong hover:border-ink',
                !supported && 'cursor-not-allowed opacity-40',
              )}
              title={supported ? undefined : `${mechanic.name} no trabaja con este tipo de bici`}
            >
              <input type="radio" name="bike-type" className="sr-only" value={t.id} checked={value === t.id} disabled={!supported} onChange={() => onChange(t.id)} />
              {t.label}
            </label>
          );
        })}
      </div>
      {error && <div className="mt-2"><FieldError>{error}</FieldError></div>}
    </fieldset>
  );
}

export function StepBike({
  draft,
  set,
  mechanic,
  errors,
  bikes,
  user,
  guestHint,
}: StepProps & { bikes: Bike[]; user: User | null; guestHint: ReactNode }) {
  const inspection = draft.category === 'inspection';
  const canUseGarage = !inspection && bikes.length > 0;
  const showNewForm = inspection || !canUseGarage || draft.bikeChoice === 'new';
  const setBike = (patch: Partial<RequestDraft['bike']>) => set({ bike: { ...draft.bike, ...patch } });

  return (
    <div className="space-y-6">
      {inspection && (
        <p className="rounded-2xl bg-sand p-4 text-sm">
          Cuéntanos qué bici quieres comprar. {mechanic.name.split(' ')[0]} la revisará antes de que pagues.
        </p>
      )}
      {!user && !inspection && guestHint}

      {canUseGarage && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Elige de tu garaje</legend>
          <div className="grid gap-2.5" id="field-bikeId" tabIndex={-1}>
            {bikes.map((b) => (
              <ChoiceCard
                key={b.id}
                name="bike"
                value={b.id}
                selected={draft.bikeChoice === 'garage' && draft.bikeId === b.id}
                onSelect={() => set({ bikeChoice: 'garage', bikeId: b.id })}
                icon={<BikeIcon className="size-5" />}
                title={b.name}
                description={`${b.brand} ${b.model} · ${bikeTypeLabel(b.type)}${mechanic.bikeTypes.includes(b.type) ? '' : ' · no compatible con este mecánico'}`}
              />
            ))}
            <ChoiceCard
              name="bike"
              value="new"
              selected={draft.bikeChoice === 'new'}
              onSelect={() => set({ bikeChoice: 'new', bikeId: undefined })}
              icon={<Plus className="size-5" />}
              title="Otra bici"
              description="Introduce los datos básicos."
            />
          </div>
          {errors.bikeId && <div className="mt-2"><FieldError>{errors.bikeId}</FieldError></div>}
        </fieldset>
      )}

      {showNewForm && (
        <div className="space-y-5 rounded-2xl border border-line p-4 sm:p-5">
          <BikeTypePicker value={draft.bike.type} onChange={(type) => setBike({ type })} mechanic={mechanic} error={errors.type} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Marca" error={errors.brand}>
              <Input name="brand" value={draft.bike.brand} onChange={(e) => setBike({ brand: e.target.value })} placeholder="Ej.: Orbea" autoComplete="off" />
            </Field>
            <Field label="Modelo" error={errors.model}>
              <Input name="model" value={draft.bike.model} onChange={(e) => setBike({ model: e.target.value })} placeholder="Ej.: Occam H30" autoComplete="off" />
            </Field>
            <Field label="Año" optional>
              <Input
                name="year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={new Date().getFullYear() + 1}
                value={draft.bike.year ?? ''}
                onChange={(e) => setBike({ year: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
            {!inspection && (
              <Field label="Nombre en tu garaje" optional>
                <Input name="bike-name" value={draft.bike.name} onChange={(e) => setBike({ name: e.target.value })} placeholder="Ej.: La de monte" />
              </Field>
            )}
          </div>
          {inspection && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Precio que piden" optional error={errors.askingPrice} hint="En euros.">
                <Input
                  name="asking-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.inspection.askingPrice ?? ''}
                  onChange={(e) => set({ inspection: { ...draft.inspection, askingPrice: e.target.value ? Number(e.target.value) : undefined } })}
                />
              </Field>
              <Field label="¿Dónde está la bici?" optional hint="Barrio o municipio del vendedor.">
                <Input
                  name="seller-location"
                  value={draft.inspection.sellerLocation ?? ''}
                  onChange={(e) => set({ inspection: { ...draft.inspection, sellerLocation: e.target.value } })}
                />
              </Field>
              <Field label="Referencia del anuncio" optional className="sm:col-span-2" hint="Texto libre. No enlazamos con portales externos en la demo.">
                <Input
                  name="listing"
                  value={draft.inspection.listingReference ?? ''}
                  onChange={(e) => set({ inspection: { ...draft.inspection, listingReference: e.target.value } })}
                />
              </Field>
            </div>
          )}
          <Checkbox
            checked={draft.saveBike}
            onChange={(saveBike) => set({ saveBike })}
            label={inspection ? 'Añadirla a mi garaje' : 'Guardar esta bici en mi garaje'}
            description={inspection ? 'Útil si finalmente la compras.' : 'Así quedará su historial de mantenimiento.'}
          />
        </div>
      )}

      <Field label="¿Algo más sobre la bici?" optional hint="Componentes, modificaciones, golpes anteriores…">
        <Textarea name="bike-notes" rows={2} value={draft.bike.notes} onChange={(e) => setBike({ notes: e.target.value })} />
      </Field>
    </div>
  );
}

export function StepWhereWhen({ draft, set, mechanic, errors }: StepProps) {
  const today = toISODate(new Date());
  const toggleSlot = (slot: (typeof TIME_SLOTS)[number]['id']) => {
    const slots = draft.availability.timeSlots.includes(slot)
      ? draft.availability.timeSlots.filter((s) => s !== slot)
      : [...draft.availability.timeSlots, slot];
    set({ availability: { ...draft.availability, timeSlots: slots } });
  };
  const homeCovers = !draft.location || mechanic.serviceAreas.includes(draft.location);
  return (
    <div className="space-y-6">
      <Field label="Zona" error={errors.location}>
        <Select name="location" value={draft.location ?? ''} onChange={(e) => set({ location: (e.target.value || undefined) as RequestDraft['location'] })}>
          <option value="">Elige tu zona</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Modalidad</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" id="field-mode" tabIndex={-1}>
          <ChoiceCard
            name="mode"
            value="home"
            selected={draft.mode === 'home'}
            onSelect={() => set({ mode: 'home' })}
            disabled={!mechanic.homeService}
            icon={<Home className="size-5" />}
            title="A domicilio"
            description={
              !mechanic.homeService
                ? 'No disponible con este mecánico.'
                : !homeCovers
                  ? 'No se desplaza a la zona elegida.'
                  : mechanic.homeServiceFee
                    ? `Desplazamiento: ${formatPrice(mechanic.homeServiceFee)}`
                    : 'Desplazamiento incluido.'
            }
          />
          <ChoiceCard
            name="mode"
            value="workshop"
            selected={draft.mode === 'workshop'}
            onSelect={() => set({ mode: 'workshop' })}
            disabled={!mechanic.workshop}
            icon={<Store className="size-5" />}
            title="En taller"
            description={mechanic.workshop ? mechanic.workshopArea ?? 'Llevas tú la bici.' : 'Solo trabaja a domicilio.'}
          />
        </div>
        {errors.mode && <div className="mt-2"><FieldError>{errors.mode}</FieldError></div>}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha preferida" optional error={errors.preferredDate} hint="El mecánico te propondrá una fecha concreta.">
          <Input
            name="preferred-date"
            type="date"
            min={today}
            value={draft.availability.preferredDate ?? ''}
            onChange={(e) => set({ availability: { ...draft.availability, preferredDate: e.target.value || undefined } })}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Franjas que te vienen bien</legend>
        <div className="flex flex-wrap gap-2" id="field-timeSlots" tabIndex={-1}>
          {TIME_SLOTS.map((s) => (
            <ToggleChip key={s.id} pressed={draft.availability.timeSlots.includes(s.id)} onToggle={() => toggleSlot(s.id)}>
              {s.label} <span className={cx('text-xs', draft.availability.timeSlots.includes(s.id) ? 'text-paper/70' : 'text-muted')}>{s.hours}</span>
            </ToggleChip>
          ))}
        </div>
        <div className="mt-3">
          <Checkbox
            checked={draft.availability.flexible}
            onChange={(flexible) => set({ availability: { ...draft.availability, flexible } })}
            label="Tengo flexibilidad"
            description="Me adapto al hueco que proponga el mecánico."
          />
        </div>
        {errors.timeSlots && <div className="mt-2"><FieldError>{errors.timeSlots}</FieldError></div>}
      </fieldset>

      <p className="flex items-start gap-2 rounded-2xl bg-sand p-4 text-sm">
        <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Agenda de {mechanic.name.split(' ')[0]}:</strong> {mechanic.availabilityNote}
        </span>
      </p>

      <Field label="Notas para la cita" optional>
        <Textarea
          name="availability-notes"
          rows={2}
          value={draft.availability.notes}
          onChange={(e) => set({ availability: { ...draft.availability, notes: e.target.value } })}
          placeholder="Ej.: portal con escalón, mejor llamar al llegar."
        />
      </Field>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted">{title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold hover:bg-sand" aria-label={`Editar: ${title}`}>
          <Pencil className="size-3.5" aria-hidden /> Editar
        </button>
      </div>
      {children}
    </section>
  );
}

export function StepReview({
  draft,
  mechanic,
  bikes,
  goTo,
  ownerPicker,
}: {
  draft: RequestDraft;
  mechanic: Mechanic;
  bikes: Bike[];
  goTo: (step: number) => void;
  ownerPicker: ReactNode;
}) {
  const garageBike = draft.category !== 'inspection' && draft.bikeChoice === 'garage' ? bikes.find((b) => b.id === draft.bikeId) : undefined;
  const bike = garageBike ?? draft.bike;
  return (
    <div className="space-y-3">
      <section className="flex items-center gap-3 rounded-2xl bg-sand p-4">
        <Avatar name={mechanic.name} tone={mechanic.avatarTone} />
        <div>
          <p className="text-sm text-muted">Solicitud para</p>
          <p className="font-bold">{mechanic.name} · {mechanic.businessName}</p>
        </div>
      </section>
      <ReviewBlock title="El problema" onEdit={() => goTo(0)}>
        <p className="font-semibold">{draft.category && categoryLabel(draft.category)}</p>
        <p className="mt-1 whitespace-pre-line text-[15px]">{draft.description}</p>
      </ReviewBlock>
      <ReviewBlock title={draft.category === 'inspection' ? 'La bici que quieres comprar' : 'Tu bici'} onEdit={() => goTo(1)}>
        <p className="font-semibold">
          {'name' in bike && bike.name ? `${bike.name} · ` : ''}
          {bike.brand} {bike.model}
        </p>
        <p className="text-sm text-muted">
          {bike.type && bikeTypeLabel(bike.type)}
          {bike.year ? ` · ${bike.year}` : ''}
          {!garageBike && draft.saveBike && ' · se guardará en tu garaje'}
        </p>
        {draft.category === 'inspection' && (draft.inspection.askingPrice || draft.inspection.sellerLocation) && (
          <p className="mt-1 text-sm">
            {draft.inspection.askingPrice ? `Precio pedido: ${formatPrice(draft.inspection.askingPrice)}` : ''}
            {draft.inspection.askingPrice && draft.inspection.sellerLocation ? ' · ' : ''}
            {draft.inspection.sellerLocation ? `Está en: ${draft.inspection.sellerLocation}` : ''}
          </p>
        )}
        {draft.bike.notes && <p className="mt-1 text-sm text-muted">{draft.bike.notes}</p>}
      </ReviewBlock>
      <ReviewBlock title="Dónde y cuándo" onEdit={() => goTo(2)}>
        <p className="font-semibold">
          {draft.mode && modeLabel(draft.mode)} · {draft.location && locationLabel(draft.location)}
        </p>
        <p className="text-sm text-muted">
          {draft.availability.preferredDate ? `Preferencia: ${formatLongDate(draft.availability.preferredDate)} · ` : ''}
          {draft.availability.timeSlots.map(slotLabel).join(', ') || 'Sin franja concreta'}
          {draft.availability.flexible ? ' · flexible' : ''}
        </p>
        {draft.availability.notes && <p className="mt-1 text-sm">{draft.availability.notes}</p>}
      </ReviewBlock>
      {ownerPicker}
    </div>
  );
}
