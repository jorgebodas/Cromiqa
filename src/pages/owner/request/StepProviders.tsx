import { Check, Home, Store } from 'lucide-react';
import type { Mechanic } from '@/domain/types';
import { RECOMMENDED_COUNT, type Match } from '@/domain/logic/matching';
import { Avatar, DemoTag, FieldError, cx } from '@/components/ui';

function ProviderOption({ match, selected, onToggle }: { match: Match; selected: boolean; onToggle: () => void }) {
  const m = match.mechanic;
  return (
    <li>
      <label
        className={cx(
          'surface flex cursor-pointer items-center gap-3 p-4 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
          selected && 'ring-2 ring-ink',
        )}
        data-testid="provider-option"
      >
        <input type="radio" name="mechanic" className="sr-only" checked={selected} onChange={onToggle} aria-describedby={`why-${m.id}`} />
        <Avatar name={m.name} tone={m.avatarTone} size="sm" className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{m.name}</span>
            <DemoTag />
          </span>
          <span id={`why-${m.id}`} className="mt-0.5 block text-sm text-muted">
            {match.reasons.join(' · ')}
          </span>
          <span className="mt-1 flex items-center gap-3 text-xs text-muted">
            {m.workshop && (
              <span className="inline-flex items-center gap-1">
                <Store className="size-3.5" aria-hidden /> Taller
              </span>
            )}
            {m.homeService && (
              <span className="inline-flex items-center gap-1">
                <Home className="size-3.5" aria-hidden /> A domicilio
              </span>
            )}
          </span>
        </span>
        <span
          className={cx('flex size-7 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-ink bg-ink text-paper' : 'border-line-strong')}
          aria-hidden
        >
          {selected && <Check className="size-4" />}
        </span>
      </label>
    </li>
  );
}

/**
 * Choose the one mechanic who receives the request: three recommended (with factual reasons)
 * and the rest of the compatible ones. Nothing is preselected except the provider the request
 * started from; the cyclist confirms on the next step.
 */
export function StepProviders({
  matches,
  selected,
  onChange,
  origin,
  error,
}: {
  matches: Match[];
  selected: string[];
  onChange: (ids: string[]) => void;
  origin?: Mechanic;
  error?: string;
}) {
  // One request = one mechanic: picking another replaces the choice.
  const toggle = (id: string) => onChange(selected.includes(id) ? [] : [id]);
  const recommended = matches.slice(0, RECOMMENDED_COUNT);
  const others = matches.slice(RECOMMENDED_COUNT);
  const originMissing = origin && !matches.some((m) => m.mechanic.id === origin.id);

  if (matches.length === 0) {
    return (
      <div className="surface p-5" data-testid="no-matches">
        <p className="font-semibold">Ningún mecánico de la demo encaja con esta solicitud.</p>
        <p className="mt-1 text-sm text-muted">Prueba otra zona, cambia entre domicilio y taller, o revisa el tipo de servicio o de bici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="field-mechanicIds" tabIndex={-1}>
      <p className="text-[15px] text-muted">
        Elige un mecánico: recibirá tu solicitud y te responderá. Si quieres consultar a otro, crea otra solicitud.
      </p>
      {originMissing && (
        <p className="rounded-2xl bg-sand p-4 text-sm">{origin.name} no puede atender esta solicitud con lo que has indicado; elige otros profesionales.</p>
      )}
      <section aria-labelledby="recommended-title">
        <h2 id="recommended-title" className="mb-2 px-1 text-sm font-semibold text-muted">
          Recomendados para ti
        </h2>
        <ul className="space-y-2.5">
          {recommended.map((m) => (
            <ProviderOption key={m.mechanic.id} match={m} selected={selected.includes(m.mechanic.id)} onToggle={() => toggle(m.mechanic.id)} />
          ))}
        </ul>
      </section>
      {others.length > 0 && (
        <section aria-labelledby="others-title">
          <h2 id="others-title" className="mb-2 px-1 text-sm font-semibold text-muted">
            Más mecánicos compatibles
          </h2>
          <ul className="space-y-2.5">
            {others.map((m) => (
              <ProviderOption key={m.mechanic.id} match={m} selected={selected.includes(m.mechanic.id)} onToggle={() => toggle(m.mechanic.id)} />
            ))}
          </ul>
        </section>
      )}
      {error && <FieldError>{error}</FieldError>}
      <p className="px-1 text-xs text-muted">
        Ordenados por cercanía, especialidad, disponibilidad habitual y confianza. Son perfiles de demostración; no indicamos huecos libres concretos.
      </p>
    </div>
  );
}
