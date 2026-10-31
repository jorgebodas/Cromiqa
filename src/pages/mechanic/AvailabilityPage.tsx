import { Check } from 'lucide-react';
import type { TimeSlot, Weekday } from '@/domain/types';
import { TIME_SLOTS, WEEKDAYS } from '@/domain/catalog';
import { toISODate } from '@/domain/utils';
import { useCurrentMechanic } from '@/state/selectors';
import { RoleGate } from '@/components/layout/RoleGate';
import { Card, Field, Input, Textarea, cx } from '@/components/ui';
import { useProfileEditor } from './useProfileEditor';
import { SaveBar } from './SaveBar';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

function Inner() {
  const mechanic = useCurrentMechanic()!;
  const { form, set, errors, saving, dirty, save, discard } = useProfileEditor(mechanic, ['weeklyAvailability', 'nextAvailableDate', 'availabilityNote']);

  const has = (day: Weekday, slot: TimeSlot) => form.weeklyAvailability.some((w) => w.day === day && w.slots.includes(slot));
  const toggle = (day: Weekday, slot: TimeSlot) => {
    const existing = form.weeklyAvailability.find((w) => w.day === day);
    let next = form.weeklyAvailability.filter((w) => w.day !== day);
    const slots = existing ? (existing.slots.includes(slot) ? existing.slots.filter((s) => s !== slot) : [...existing.slots, slot]) : [slot];
    if (slots.length) next = [...next, { day, slots: TIME_SLOTS.map((t) => t.id).filter((t) => slots.includes(t)) }];
    set({ weeklyAvailability: next.sort((a, b) => a.day - b.day) });
  };

  return (
    <>
      <ScreenHeader title="Agenda" description="Orienta a los clientes. La cita concreta siempre la propones tú en cada solicitud." />
      <div className="container-page max-w-3xl pb-8 sm:pb-10">

      <Card className="p-5">
        <h2 className="font-bold">Franjas habituales</h2>
        <p className="mt-1 text-sm text-muted">Pulsa para activar o desactivar cada franja.</p>
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-28" />
                {WEEKDAYS.map((d) => (
                  <th key={d.id} scope="col" className="pb-1 font-medium text-muted">
                    <abbr title={d.label} className="no-underline">{d.label.slice(0, 3)}</abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => (
                <tr key={slot.id}>
                  <th scope="row" className="pr-2 text-left font-medium">
                    {slot.label}
                    <span className="block text-xs font-normal text-muted">{slot.hours}</span>
                  </th>
                  {WEEKDAYS.map((d) => {
                    const on = has(d.id, slot.id);
                    return (
                      <td key={d.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${d.label}, ${slot.label}`}
                          onClick={() => toggle(d.id, slot.id)}
                          className={cx(
                            'flex h-11 w-full items-center justify-center rounded-xl border transition-colors',
                            on ? 'border-ink bg-ink text-lime' : 'border-line bg-sand hover:border-line-strong',
                          )}
                        >
                          {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4 space-y-4 p-5">
        <Field label="Próximo hueco disponible" hint="Se muestra en los resultados de búsqueda." error={errors.nextAvailableDate}>
          <Input type="date" min={toISODate(new Date())} value={form.nextAvailableDate ?? ''} onChange={(e) => set({ nextAvailableDate: e.target.value || undefined })} className="max-w-56" name="next-date" />
        </Field>
        <Field label="Nota de disponibilidad" hint="Ej.: «Tardes entre semana y sábados por la mañana».">
          <Textarea rows={2} value={form.availabilityNote} onChange={(e) => set({ availabilityNote: e.target.value })} name="availability-note" />
        </Field>
      </Card>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
      </div>
    </>
  );
}

export function AvailabilityPage() {
  return (
    <RoleGate role="mechanic">
      <Inner />
    </RoleGate>
  );
}
