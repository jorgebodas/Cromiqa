import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Send, X } from 'lucide-react';
import type { ID } from '@/domain/types';
import { DomainError } from '@/domain/logic/requests';
import { useApp, type RequestDraft } from '@/state/store';
import { useCurrentUser, useMechanic, useOwnerBikes } from '@/state/selectors';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, ChoiceCard, FieldError, IconButton, cx } from '@/components/ui';
import { BackLink } from '@/components/layout/BackLink';
import { ModeIndicators } from '@/components/domain/MechanicCard';
import { parseSearchParams } from '../searchParams';
import { STEP_TITLES, draftToInput, firstInvalidStep, validateStep, type DraftErrors } from './draftValidation';
import { StepBike, StepProblem, StepReview, StepWhereWhen } from './Steps';

export function RequestFlowPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const draft = useApp((s) => s.draft);
  const setDraft = useApp((s) => s.setDraft);
  const resetDraft = useApp((s) => s.resetDraft);
  const createRequest = useApp((s) => s.createRequest);
  const switchUser = useApp((s) => s.switchUser);
  const toast = useApp((s) => s.toast);
  const users = useApp((s) => s.db.users);
  const user = useCurrentUser();
  const switchAccount = useSwitchAccount();

  const paramMechanic = params.get('mecanico') ?? undefined;
  const mechanicId = paramMechanic ?? draft.mechanicId;
  const mechanic = useMechanic(mechanicId);
  const isOwner = user?.role === 'owner';
  const bikes = useOwnerBikes(isOwner ? user.id : undefined);

  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pickedOwner, setPickedOwner] = useState<ID | null>(isOwner ? user.id : null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialised = useRef(false);

  // Entering the flow for a (new) mechanic: adopt it and prefill from the search filters.
  useEffect(() => {
    if (initialised.current || !mechanic) return;
    initialised.current = true;
    if (draft.mechanicId === mechanic.id) return;
    const f = parseSearchParams(params);
    const patch: Partial<RequestDraft> = { mechanicId: mechanic.id, step: 0 };
    const category = draft.category ?? f.category;
    if (category && mechanic.services.some((s) => s.category === category)) patch.category = category;
    else patch.category = undefined;
    patch.location = draft.location ?? f.location ?? (isOwner ? user.location : undefined);
    const mode = draft.mode ?? f.mode;
    patch.mode = mode === 'home' && !mechanic.homeService ? undefined : mode === 'workshop' && !mechanic.workshop ? undefined : mode;
    if (!mechanic.homeService) patch.mode = 'workshop';
    if (!mechanic.workshop) patch.mode = 'home';
    if (!draft.bike.type && f.bikeType) patch.bike = { ...draft.bike, type: f.bikeType };
    setDraft(patch);
  }, [mechanic, draft, params, setDraft, isOwner, user]);

  // Preselect the first compatible garage bike.
  useEffect(() => {
    if (draft.bikeChoice === 'garage' && !draft.bikeId && bikes.length && mechanic) {
      const preferred = bikes.find((b) => b.type === draft.bike.type && mechanic.bikeTypes.includes(b.type)) ?? bikes.find((b) => mechanic.bikeTypes.includes(b.type));
      if (preferred) setDraft({ bikeId: preferred.id });
    }
  }, [bikes, draft.bikeChoice, draft.bikeId, draft.bike.type, mechanic, setDraft]);

  useEffect(() => {
    if (isOwner) setPickedOwner(user.id);
  }, [isOwner, user]);

  const step = Math.min(Math.max(draft.step, 0), 3);
  const owners = useMemo(() => users.filter((u) => u.role === 'owner'), [users]);

  if (!mechanicId) return <Navigate to="/mecanicos" replace />;
  if (!mechanic) {
    return (
      <div className="container-page py-12 text-center">
        <p className="text-lg font-semibold">Este mecánico no existe en la demo.</p>
        <Link to="/mecanicos" className="mt-4 inline-block font-semibold underline">Elegir otro mecánico</Link>
      </div>
    );
  }

  const goTo = (s: number) => {
    setErrors({});
    setDraft({ step: s });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    const e = validateStep(step, draft, mechanic, bikes);
    setErrors(e);
    const firstKey = Object.keys(e)[0];
    if (firstKey) {
      const el = document.getElementById(`field-${firstKey}`) ?? document.querySelector<HTMLElement>(`[name="${firstKey}"]`) ?? document.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      return;
    }
    goTo(step + 1);
  };

  const submit = async () => {
    setSubmitError(null);
    const invalid = firstInvalidStep(draft, mechanic, bikes);
    if (invalid !== null) {
      goTo(invalid);
      setErrors(validateStep(invalid, draft, mechanic, bikes));
      return;
    }
    const ownerId = isOwner ? user.id : pickedOwner;
    if (!ownerId) {
      setErrors({ owner: 'Elige con qué cuenta de demostración envías la solicitud.' });
      document.getElementById('field-owner')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      // Guests pick a demo owner here: in production this would be a light sign-up.
      const ownerBikes = ownerId === user?.id ? bikes : [];
      const input = draftToInput(draft, ownerId, ownerBikes);
      if (ownerId !== user?.id) switchUser(ownerId);
      const request = await createRequest(input);
      resetDraft();
      toast(`Solicitud enviada a ${mechanic.name}`);
      navigate(`/solicitudes/${request.id}/enviada`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof DomainError ? err.message : 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  const guestHint = (
    <div className="flex flex-col gap-3 rounded-2xl bg-sand p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>¿Ya tienes bicis en tu garaje? Usa una cuenta de demostración.</p>
      <div className="flex gap-2">
        {owners.slice(0, 2).map((o) => (
          <Button key={o.id} size="sm" variant="secondary" onClick={() => switchAccount(o.id, { to: `/solicitar?mecanico=${mechanic.id}` })}>
            Entrar como {o.name.split(' ')[0]}
          </Button>
        ))}
      </div>
    </div>
  );

  const ownerPicker = !isOwner && (
    <section className="rounded-2xl border border-ink p-4 sm:p-5" aria-labelledby="owner-title">
      <h3 id="owner-title" className="font-semibold">¿Con qué cuenta envías la solicitud?</h3>
      <p className="mt-1 text-sm text-muted">
        {user ? 'Estás usando una cuenta de mecánico. ' : ''}En la versión real crearías tu cuenta aquí, con solo nombre y email. En la demo, elige una cuenta ficticia de propietario.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" id="field-owner" tabIndex={-1}>
        {owners.map((o) => (
          <ChoiceCard
            key={o.id}
            name="owner"
            value={o.id}
            selected={pickedOwner === o.id}
            onSelect={() => {
              setPickedOwner(o.id);
              setErrors({});
            }}
            title={o.name}
            description={o.demoBlurb}
            className="p-3"
          />
        ))}
      </div>
      {errors.owner && <div className="mt-2"><FieldError>{errors.owner}</FieldError></div>}
    </section>
  );

  const stepProps = { draft, set: setDraft, mechanic, errors };

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 max-w-2xl">
          {/* Focused flow: no tab bar here, just back, close and progress. The draft is kept either way. */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <BackLink fallback={`/mecanicos/${mechanic.id}`}>Perfil de {mechanic.name.split(' ')[0]}</BackLink>
            <IconButton
              label="Salir de la solicitud"
              onClick={() => {
                toast('Guardamos tu solicitud. Puedes seguir con ella desde «Nueva solicitud».', 'info');
                navigate('/');
              }}
              className="-mr-2"
            >
              <X className="size-5" />
            </IconButton>
          </div>

          <nav aria-label="Pasos de la solicitud">
            <ol className="grid grid-cols-4 gap-1.5">
              {STEP_TITLES.map((title, i) => (
                <li key={title}>
                  <button
                    type="button"
                    onClick={() => i < step && goTo(i)}
                    disabled={i >= step}
                    aria-current={i === step ? 'step' : undefined}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span className={cx('block h-1.5 rounded-full transition-colors', i < step ? 'bg-ink' : i === step ? 'bg-lime' : 'bg-line')} />
                    <span className={cx('mt-2 hidden text-xs sm:block', i <= step ? 'font-medium text-ink' : 'text-muted', i < step && 'group-hover:underline')}>
                      {title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <p className="eyebrow mt-8">Paso {step + 1} de 4</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-extrabold outline-none sm:text-4xl">
            {step === 1 && draft.category === 'inspection' ? 'La bici que quieres comprar' : STEP_TITLES[step]}
          </h1>

          <div className="mt-8" key={step}>
            <div className="animate-fade-in">
              {step === 0 && <StepProblem {...stepProps} />}
              {step === 1 && <StepBike {...stepProps} bikes={bikes} user={isOwner ? user : null} guestHint={guestHint} />}
              {step === 2 && <StepWhereWhen {...stepProps} />}
              {step === 3 && <StepReview draft={draft} mechanic={mechanic} bikes={bikes} goTo={goTo} ownerPicker={ownerPicker} />}
            </div>
          </div>

          {step === 3 && (
            <p className="mt-6 flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Esto no es una reserva. {mechanic.name.split(' ')[0]} revisará tu caso y te enviará una propuesta con precio y fecha. Solo se confirma si la aceptas.
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
            {step < 3 ? (
              <Button onClick={next} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
                Continuar
              </Button>
            ) : (
              <Button onClick={submit} size="lg" loading={submitting} icon={<Send className="size-4" aria-hidden />}>
                Enviar solicitud
              </Button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="surface sticky top-24 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={mechanic.name} tone={mechanic.avatarTone} />
              <div>
                <p className="font-bold">{mechanic.name}</p>
                <p className="text-sm text-muted">{mechanic.businessName}</p>
              </div>
            </div>
            <p className="mt-4 text-[15px]">{mechanic.headline}</p>
            <div className="mt-4 border-t border-line pt-4">
              <ModeIndicators home={mechanic.homeService} workshop={mechanic.workshop} />
            </div>
            <p className="mt-3 text-sm text-muted">{mechanic.responseTime}.</p>
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <li>1. Envías tu solicitud (gratis).</li>
              <li>2. {mechanic.name.split(' ')[0]} te propone precio y cita.</li>
              <li>3. Aceptas o rechazas la propuesta.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
