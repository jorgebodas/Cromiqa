import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Send, X } from 'lucide-react';
import { BIKE_TYPES, CATEGORIES, LOCATIONS, SPECIALIZATIONS, TIME_SLOTS, WEEKDAYS, bikeTypeLabel, categoryLabel, locationShort, specializationLabel } from '@/domain/catalog';
import { DomainError } from '@/domain/logic/requests';
import { ONBOARDING_STEPS, emptyProfessionalDraft, validateOnboardingStep, type ProfessionalDraft } from '@/domain/logic/onboarding';
import { formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useModeStore } from '@/state/mode';
import { storage } from '@/services/storage';
import { RoleGate } from '@/components/layout/RoleGate';
import { BackLink } from '@/components/layout/BackLink';
import { Button, Card, Field, FieldError, IconButton, Input, KeyValue, Select, Switch, Textarea, ToggleChip, cx } from '@/components/ui';

const LAST = ONBOARDING_STEPS.length - 1;
const draftKey = (userId: string) => `cromiqa:demo:pro-draft:${userId}`;

export function hasProfessionalDraft(userId: string) {
  return storage.getJSON<{ draft: ProfessionalDraft }>(draftKey(userId)) !== null;
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Chips<T extends string | number>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <ToggleChip key={String(o.id)} pressed={value.includes(o.id)} onToggle={() => onChange(toggle(value, o.id))}>
          {o.label}
        </ToggleChip>
      ))}
    </div>
  );
}

function Inner() {
  const user = useCurrentUser()!;
  const submitProfile = useApp((s) => s.submitProfessionalProfile);
  const toast = useApp((s) => s.toast);
  const setMode = useModeStore((s) => s.setMode);
  const navigate = useNavigate();
  // The draft stays on this device until it's submitted (the "borrador" state).
  const saved = storage.getJSON<{ step: number; draft: ProfessionalDraft }>(draftKey(user.id));
  const [d, setD] = useState<ProfessionalDraft>(() => ({ ...emptyProfessionalDraft(user.location), ...saved?.draft }));
  const [step, setStep] = useState(() => Math.min(saved?.step ?? 0, LAST));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!user.mechanicId) storage.setJSON(draftKey(user.id), { step, draft: d });
  }, [d, step, user.id, user.mechanicId]);

  if (user.mechanicId) return <Navigate to="/pro" replace />;

  const set = (patch: Partial<ProfessionalDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setErrors({});
  };
  const goTo = (s: number) => {
    setStep(s);
    setErrors({});
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };
  const next = () => {
    const e = validateOnboardingStep(step, d);
    setErrors(e);
    if (Object.keys(e).length) return;
    goTo(step + 1);
  };
  const submit = async () => {
    const e = validateOnboardingStep(LAST, d);
    if (Object.keys(e).length) {
      setErrors(e);
      const first = ONBOARDING_STEPS.findIndex((_, i) => Object.keys(validateOnboardingStep(i, d)).length > 0);
      if (first >= 0 && first < LAST) goTo(first);
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await submitProfile(d);
      storage.remove(draftKey(user.id));
      setMode(user.id, 'mechanic');
      toast('Perfil enviado a verificación. Ya tienes el modo mecánico.');
      navigate('/pro', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof DomainError ? err.message : 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const service = (c: (typeof CATEGORIES)[number]['id']) => d.services.find((s) => s.category === c);
  const setService = (c: (typeof CATEGORIES)[number]['id'], on: boolean, priceFrom?: number) =>
    set({ services: on ? [...d.services.filter((s) => s.category !== c), { category: c, priceFrom }] : d.services.filter((s) => s.category !== c) });

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BackLink fallback="/cuenta">Perfil</BackLink>
          <IconButton
            label="Salir del alta"
            onClick={() => {
              toast('Guardamos tu borrador. Puedes seguir desde tu perfil.', 'info');
              navigate('/cuenta');
            }}
            className="-mr-2"
          >
            <X className="size-5" />
          </IconButton>
        </div>

        <nav aria-label="Pasos del alta">
          <ol className="grid grid-cols-5 gap-1.5">
            {ONBOARDING_STEPS.map((title, i) => (
              <li key={title}>
                <button type="button" onClick={() => i < step && goTo(i)} disabled={i >= step} aria-current={i === step ? 'step' : undefined} aria-label={`Paso ${i + 1}: ${title}`} className="group w-full text-left disabled:cursor-default">
                  <span className={cx('block h-1.5 rounded-full transition-colors', i < step ? 'bg-ink' : i === step ? 'bg-lime' : 'bg-line')} />
                  <span className={cx('mt-2 hidden text-xs sm:block', i <= step ? 'font-medium text-ink' : 'text-muted', i < step && 'group-hover:underline')}>{title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <p className="eyebrow mt-8">
          Alta profesional · Paso {step + 1} de {ONBOARDING_STEPS.length}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-extrabold outline-none sm:text-4xl">
          {ONBOARDING_STEPS[step]}
        </h1>

        <div className="mt-8 space-y-5" key={step}>
          {step === 0 && (
            <>
              <Field label="Nombre profesional o del taller" error={errors.businessName}>
                <Input value={d.businessName} onChange={(e) => set({ businessName: e.target.value })} maxLength={60} placeholder="Ej.: Taller Ruedas de Rivas" />
              </Field>
              <Field label="Especialidad principal" error={errors.headline} hint="Una línea. Aparece bajo tu nombre.">
                <Input value={d.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={80} placeholder="Ej.: Especialista en MTB y suspensiones" />
              </Field>
              <Field label="Sobre ti" error={errors.bio} hint={`${d.bio.trim().length} caracteres · mínimo 30`}>
                <Textarea rows={5} value={d.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={900} />
              </Field>
              <Field label="Años de experiencia" error={errors.yearsExperience}>
                <Input type="number" inputMode="numeric" min={0} max={60} value={d.yearsExperience} onChange={(e) => set({ yearsExperience: Number(e.target.value) })} className="max-w-32" />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <fieldset>
                <legend className="mb-1 font-semibold">Especialidades</legend>
                <p className="mb-3 text-sm text-muted">La primera que elijas se destaca en tu perfil.</p>
                <Chips options={SPECIALIZATIONS} value={d.specializations} onChange={(specializations) => set({ specializations })} />
                {errors.specializations && <div className="mt-2"><FieldError>{errors.specializations}</FieldError></div>}
              </fieldset>
              <fieldset>
                <legend className="mb-3 font-semibold">Tipos de bici con los que trabajas</legend>
                <Chips options={BIKE_TYPES} value={d.bikeTypes} onChange={(bikeTypes) => set({ bikeTypes })} />
                {errors.bikeTypes && <div className="mt-2"><FieldError>{errors.bikeTypes}</FieldError></div>}
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              <Card className="space-y-4 p-5">
                <Switch checked={d.workshop} onChange={(workshop) => set({ workshop })} label="Tengo taller" description="Los ciclistas te llevan la bici." />
                {d.workshop && (
                  <>
                    <Field label="Municipio del taller">
                      <Select value={d.baseLocation} onChange={(e) => set({ baseLocation: e.target.value as ProfessionalDraft['baseLocation'] })}>
                        {LOCATIONS.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Zona del taller" error={errors.workshopArea} hint="Barrio o zona. No pongas la dirección exacta: se comparte al confirmar la cita.">
                      <Input value={d.workshopArea} onChange={(e) => set({ workshopArea: e.target.value })} maxLength={60} placeholder="Ej.: Rivas Urbanizaciones" />
                    </Field>
                  </>
                )}
              </Card>
              <Card className="space-y-4 p-5">
                <Switch checked={d.homeService} onChange={(homeService) => set({ homeService })} label="Voy a domicilio" description="Te desplazas a casa del ciclista." />
                {d.homeService && (
                  <>
                    <fieldset>
                      <legend className="mb-3 text-sm font-medium">Zonas a las que te desplazas</legend>
                      <Chips options={LOCATIONS.map((l) => ({ id: l.id, label: l.short }))} value={d.serviceAreas} onChange={(serviceAreas) => set({ serviceAreas })} />
                      {errors.serviceAreas && <div className="mt-2"><FieldError>{errors.serviceAreas}</FieldError></div>}
                    </fieldset>
                    <Field label="Desplazamiento (€)" optional error={errors.homeServiceFee}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={d.homeServiceFee ?? ''}
                        onChange={(e) => set({ homeServiceFee: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="max-w-32"
                      />
                    </Field>
                  </>
                )}
              </Card>
              {errors.mode && <FieldError>{errors.mode}</FieldError>}
              <fieldset>
                <legend className="mb-3 font-semibold">Días que trabajas</legend>
                <Chips options={WEEKDAYS.map((w) => ({ id: w.id, label: w.short }))} value={d.days} onChange={(days) => set({ days })} />
                {errors.days && <div className="mt-2"><FieldError>{errors.days}</FieldError></div>}
              </fieldset>
              <fieldset>
                <legend className="mb-3 font-semibold">Franjas</legend>
                <Chips options={TIME_SLOTS} value={d.slots} onChange={(slots) => set({ slots })} />
                {errors.slots && <div className="mt-2"><FieldError>{errors.slots}</FieldError></div>}
              </fieldset>
            </>
          )}

          {step === 3 && (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-1 font-semibold">Servicios que ofreces</legend>
                <p className="text-sm text-muted">Precio orientativo “desde”. Déjalo vacío si es a consultar; el precio final va en cada presupuesto.</p>
                {CATEGORIES.map((c) => {
                  const s = service(c.id);
                  return (
                    <Card key={c.id} className={cx('flex flex-wrap items-center gap-3 p-4', s && 'ring-2 ring-ink')}>
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input type="checkbox" className="size-5 accent-[var(--color-ink)]" checked={!!s} onChange={(e) => setService(c.id, e.target.checked, s?.priceFrom)} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{c.label}</span>
                          <span className="block text-sm text-muted">{c.short}</span>
                        </span>
                      </label>
                      {s && (
                        <label className="flex items-center gap-2 text-sm">
                          Desde
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            aria-label={`Precio desde para ${c.label}`}
                            value={s.priceFrom ?? ''}
                            onChange={(e) => setService(c.id, true, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="w-24"
                          />
                          €
                        </label>
                      )}
                    </Card>
                  );
                })}
                {errors.services && <FieldError>{errors.services}</FieldError>}
              </fieldset>
              <Field label="Condiciones" optional hint="Lo que conviene saber antes de contratarte: garantía, recambios, forma de pago…">
                <Textarea rows={3} value={d.conditions} onChange={(e) => set({ conditions: e.target.value })} maxLength={400} />
              </Field>
            </>
          )}

          {step === 4 && (
            <Card className="p-5" data-testid="onboarding-review">
              <dl className="divide-y divide-line">
                <KeyValue label="Nombre">{d.businessName}</KeyValue>
                <KeyValue label="Especialidad">{d.headline}</KeyValue>
                <KeyValue label="Especialidades">{d.specializations.map(specializationLabel).join(', ')}</KeyValue>
                <KeyValue label="Bicis">{d.bikeTypes.map(bikeTypeLabel).join(', ')}</KeyValue>
                <KeyValue label="Modalidad">
                  {[d.workshop && `Taller en ${d.workshopArea}`, d.homeService && `A domicilio: ${d.serviceAreas.map(locationShort).join(', ')}`].filter(Boolean).join(' · ')}
                </KeyValue>
                <KeyValue label="Servicios">{d.services.map((s) => `${categoryLabel(s.category)}${s.priceFrom !== undefined ? ` desde ${formatPrice(s.priceFrom)}` : ' (a consultar)'}`).join(', ')}</KeyValue>
              </dl>
            </Card>
          )}
        </div>

        {step === LAST && (
          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Revisaremos tu perfil antes de publicarlo. Mientras tanto no aparecerás en las búsquedas ni recibirás solicitudes. En la demo puedes simular la aprobación desde tu Inicio.
          </p>
        )}
        {submitError && <div className="mt-4"><FieldError>{submitError}</FieldError></div>}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)} icon={<ArrowLeft className="size-4" aria-hidden />}>
              Atrás
            </Button>
          ) : (
            <span />
          )}
          {step < LAST ? (
            <Button onClick={next} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
              Continuar
            </Button>
          ) : (
            <Button onClick={submit} size="lg" loading={submitting} icon={<Send className="size-4" aria-hidden />}>
              Enviar a verificación
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Professional onboarding for an existing account: identity, specialties and bike types,
 * modality and coverage, services and conditions, review. The draft is kept on the device
 * until it's submitted; then the profile waits for verification before it's listed.
 */
export function OnboardingPage() {
  return (
    <RoleGate reason="Para crear tu perfil profesional, entra con una cuenta. En la demo, elige una cuenta ficticia de ciclista.">
      <Inner />
    </RoleGate>
  );
}
