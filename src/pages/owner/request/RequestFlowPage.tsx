import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Send, X } from 'lucide-react';
import type { ID, ServiceRequest } from '@/domain/types';
import { DomainError, MAX_RECIPIENTS_PER_SEND } from '@/domain/logic/requests';
import { matchProviders } from '@/domain/logic/matching';
import { useApp, type RequestDraft } from '@/state/store';
import { useCurrentUser, useMechanic, useOwnerBikes } from '@/state/selectors';
import { useMode } from '@/state/mode';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, ChoiceCard, FieldError, IconButton, cx } from '@/components/ui';
import { BackLink } from '@/components/layout/BackLink';
import { parseSearchParams } from '../searchParams';
import { LAST_STEP, STEP, STEP_HEADINGS, STEP_TITLES, draftBikeType, draftToInput, firstInvalidStep, validateStep, type DraftErrors } from './draftValidation';
import { StepProviders } from './StepProviders';
import { StepBike, StepProblem, StepReview, StepWhen, StepWhere } from './Steps';
import { StepPhotos } from './StepPhotos';
import { useHubAction } from '@/components/hub/hubAction';

export interface RequestFormProps {
  /** `page`: the /solicitar screen. `overlay`: inside the Request Hub panel. */
  variant: 'page' | 'overlay';
  /** Mechanic-first: the provider the request started from (preselected, narrows choices). */
  originMechanicId?: ID;
  /** Search filters to prefill from (page entry from a provider profile). */
  params?: URLSearchParams;
  /** Called once the invitations are created. */
  onSent: (sent: ServiceRequest[]) => void;
  /** Overlay only: leave the form from its first step (back to the hub overview). */
  onBackFromStart?: () => void;
  /** Page only: where the progress bar goes (the top row, between back and close). */
  progressSlot?: HTMLElement | null;
}

/**
 * The request flow: need → bike → photos → where → when → mechanics → review. Shared by the
 * /solicitar page and the Request Hub overlay; the draft lives in the store either way.
 */
export function RequestForm({ variant, originMechanicId, params = new URLSearchParams(), onSent, onBackFromStart, progressSlot }: RequestFormProps) {
  const overlay = variant === 'overlay';
  // Inside the Request Hub, the hub's own bottom row (the + stretched) is this form's primary action.
  const hubAction = useHubAction();
  const draft = useApp((s) => s.draft);
  const setDraft = useApp((s) => s.setDraft);
  const resetDraft = useApp((s) => s.resetDraft);
  const createRequest = useApp((s) => s.createRequest);
  const switchUser = useApp((s) => s.switchUser);
  const toast = useApp((s) => s.toast);
  const users = useApp((s) => s.db.users);
  const user = useCurrentUser();
  const switchAccount = useSwitchAccount();

  // Mechanic-first: the request starts from a provider's profile (?mecanico=). That provider
  // is preselected and narrows the choices; request-first starts with nobody chosen.
  const originId = originMechanicId ?? draft.originMechanicId;
  const mechanic = useMechanic(originId);
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  // Any account in cyclist mode sends as itself; guests pick a demo account at the end.
  const mode = useMode();
  const owner = user && mode === 'cyclist' ? user : null;
  const isOwner = owner !== null;
  const bikes = useOwnerBikes(owner ? owner.id : undefined);

  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pickedOwner, setPickedOwner] = useState<ID | null>(owner ? owner.id : null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  // Entering the flow from a (new) provider's profile: preselect it and prefill from the search filters.
  useEffect(() => {
    if (initialised.current || !mechanic) return;
    initialised.current = true;
    if (draft.originMechanicId === mechanic.id) return;
    const f = parseSearchParams(params);
    const patch: Partial<RequestDraft> = { originMechanicId: mechanic.id, mechanicIds: [mechanic.id], step: 0 };
    const category = draft.category ?? f.category;
    if (category && mechanic.services.some((s) => s.category === category)) patch.category = category;
    else patch.category = undefined;
    patch.location = draft.location ?? f.location ?? (owner ? owner.location : undefined);
    const mode = draft.mode ?? f.mode;
    patch.mode = mode === 'home' && !mechanic.homeService ? undefined : mode === 'workshop' && !mechanic.workshop ? undefined : mode;
    if (!mechanic.homeService) patch.mode = 'workshop';
    if (!mechanic.workshop) patch.mode = 'home';
    if (!draft.bike.type && f.bikeType) patch.bike = { ...draft.bike, type: f.bikeType };
    setDraft(patch);
  }, [mechanic, draft, params, setDraft, isOwner, user]);

  // Start from the cyclist's own zone (they can change it).
  useEffect(() => {
    if (!draft.location && owner?.location) setDraft({ location: owner.location });
  }, [draft.location, owner?.location, setDraft]);

  // Preselect the first compatible garage bike.
  useEffect(() => {
    if (draft.bikeChoice === 'garage' && !draft.bikeId && bikes.length) {
      const fits = (type: string) => !mechanic || mechanic.bikeTypes.includes(type as never);
      const preferred = bikes.find((b) => b.type === draft.bike.type && fits(b.type)) ?? bikes.find((b) => fits(b.type));
      if (preferred) setDraft({ bikeId: preferred.id });
    }
  }, [bikes, draft.bikeChoice, draft.bikeId, draft.bike.type, mechanic, setDraft]);

  // Providers that can take the request as described so far (checked again on send).
  const bikeType = draftBikeType(draft, bikes);
  const matches = useMemo(
    () =>
      draft.category && draft.mode && draft.location
        ? matchProviders(mechanics, reviews, { category: draft.category, bikeType, mode: draft.mode, location: draft.location, description: draft.description, excludeMechanicId: user?.mechanicId })
        : [],
    [mechanics, reviews, draft.category, draft.mode, draft.location, draft.description, bikeType, user?.mechanicId],
  );
  const recipients = draft.mechanicIds.map((id) => mechanics.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m));

  useEffect(() => {
    if (owner) setPickedOwner(owner.id);
  }, [owner]);

  const step = Math.min(Math.max(draft.step, 0), LAST_STEP);
  const owners = useMemo(() => users.filter((u) => u.role === 'owner'), [users]);

  const goTo = (s: number) => {
    setErrors({});
    // Entering provider selection: drop any choice the request no longer fits.
    if (s === STEP.providers) setDraft({ step: s, mechanicIds: draft.mechanicIds.filter((id) => matches.some((m) => m.mechanic.id === id)) });
    else setDraft({ step: s });
    // In the hub panel, back to the top of the panel (progress bar included).
    if (overlay) headingRef.current?.closest('[data-hub-scroll]')?.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  /** Shows what's missing: errors under the fields, scrolls to the first one, and a hint by the button. */
  const showMissing = (e: DraftErrors) => {
    setErrors(e);
    // After the errors and the hint by the button render (two frames): go to the missing field
    // that comes first on screen, and flash it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = formRef.current ?? document;
      const found = [
        ...Object.keys(e).map((k) => root.querySelector<HTMLElement>(`#field-${k}, [name="${k}"]`)),
        ...root.querySelectorAll<HTMLElement>('[aria-invalid="true"]'),
      ].filter((x): x is HTMLElement => !!x);
      const el = found.sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0];
      if (!el) return;
      // Centre the missing field on screen; in the panel, its whole block (title and error) when it fits.
      const card = el.closest<HTMLElement>('.hub-steps > div > div > *, .hub-steps > div > #field-photos') ?? el;
      const box = overlay ? el.closest<HTMLElement>('[data-hub-scroll]') : null;
      const target = box && card.offsetHeight < box.clientHeight * 0.8 ? card : el;
      if (box) {
        const r = target.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        box.scrollTo({ top: box.scrollTop + r.top - b.top - (b.height - r.height) / 2, behavior: 'smooth' });
      } else target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      // Typed fields get a short red pulse (they already show the warning icon and border).
      if (el.matches('input, textarea, select')) {
        el.classList.remove('cq-attention');
        void el.offsetWidth; // restart the animation on every tap
        el.classList.add('cq-attention');
      }
    }));
  };

  const next = () => {
    const e = validateStep(step, draft, mechanic, bikes);
    if (Object.keys(e).length) return showMissing(e);
    setErrors({});
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
    const ownerId = owner ? owner.id : pickedOwner;
    if (!ownerId) return showMissing({ owner: 'Elige con qué cuenta de demostración envías la solicitud.' });
    if (submitting) return; // no duplicate submissions
    setSubmitting(true);
    try {
      // Guests pick a demo owner here: in production this would be a light sign-up.
      const ownerBikes = ownerId === user?.id ? bikes : [];
      const input = draftToInput(draft, ownerId, ownerBikes);
      if (ownerId !== user?.id) switchUser(ownerId);
      const sent = await createRequest(input);
      resetDraft();
      toast(sent.length === 1 ? `Solicitud enviada a ${recipients[0]?.name}` : `Solicitud enviada a ${sent.length} mecánicos`);
      onSent(sent);
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
          <Button key={o.id} size="sm" variant="secondary" onClick={() => switchAccount(o.id, { to: mechanic ? `/solicitar?mecanico=${mechanic.id}` : '/solicitar' })}>
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

  if (hubAction) {
    hubAction.runRef.current = step < LAST_STEP ? next : () => void submit();
    hubAction.backRef.current = () => (step > 0 ? goTo(step - 1) : onBackFromStart?.());
  }
  const canBack = step > 0 || Boolean(onBackFromStart);
  // The primary action looks disabled until the step's required fields are filled.
  const pending = step < LAST_STEP ? validateStep(step, draft, mechanic, bikes) : (firstInvalidStep(draft, mechanic, bikes) === null && (owner || pickedOwner)) ? {} : { owner: 'x' };
  const ready = Object.keys(pending).length === 0;
  useEffect(() => {
    hubAction?.setMeta({ label: step < LAST_STEP ? 'Continuar' : 'Enviar solicitud', icon: step < LAST_STEP ? 'arrow' : 'send', loading: submitting, canBack, disabled: !ready });
  }, [hubAction, step, submitting, canBack, ready]);
  useEffect(() => () => hubAction?.setMeta(null), [hubAction]);

  // The progress bar lives up top, between back and close (hub header or the page's top row).
  const slot = overlay ? hubAction?.headerSlot : progressSlot;
  const progress = (
    <nav aria-label="Pasos de la solicitud">
      <ol className={cx('grid', overlay ? 'gap-1' : 'gap-1.5')} style={{ gridTemplateColumns: `repeat(${STEP_TITLES.length}, minmax(0, 1fr))` }}>
        {STEP_TITLES.map((title, i) => (
          <li key={title}>
            <button
              type="button"
              onClick={() => i < step && goTo(i)}
              disabled={i >= step}
              aria-current={i === step ? 'step' : undefined}
              aria-label={`Paso ${i + 1}: ${title}`}
              className="group block w-full py-2 text-left disabled:cursor-default"
            >
              <span className={cx('block h-1.5 rounded-full transition-colors', i <= step ? 'bg-[#3b3b3b]' : 'bg-line')} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );

  const body = (
    <>
          {slot ? createPortal(progress, slot) : progress}

          <p className="sr-only">Paso {step + 1} de {STEP_TITLES.length}</p>
          <h1 ref={headingRef} tabIndex={-1} className={cx('scroll-mt-4 font-extrabold outline-none', overlay ? 'mt-1 text-[22px] leading-tight' : 'mt-2 text-3xl sm:text-4xl')}>
            {step === STEP.bike && draft.category === 'inspection' ? 'La bici a inspeccionar' : STEP_HEADINGS[step]}
          </h1>

          <div className={cx(overlay ? 'hub-steps mt-5' : 'mt-8')} key={step}>
            <div className="animate-fade-in">
              {step === STEP.need && <StepProblem {...stepProps} />}
              {step === STEP.bike && <StepBike {...stepProps} bikes={bikes} user={owner} guestHint={guestHint} />}
              {step === STEP.photos && <StepPhotos draft={draft} set={setDraft} error={errors.photos} />}
              {step === STEP.where && <StepWhere {...stepProps} />}
              {step === STEP.when && <StepWhen {...stepProps} />}
              {step === STEP.providers && (
                <StepProviders
                  matches={matches}
                  selected={draft.mechanicIds}
                  onChange={(mechanicIds) => {
                    setErrors({});
                    setDraft({ mechanicIds });
                  }}
                  origin={mechanic}
                  error={errors.mechanicIds}
                />
              )}
              {step === STEP.review && <StepReview draft={draft} recipients={recipients} bikes={bikes} goTo={goTo} ownerPicker={ownerPicker} />}
            </div>
          </div>

          {step === LAST_STEP && (
            <p className="mt-6 flex items-start gap-2 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              Esto no es una reserva. Cada mecánico revisará tu caso y te responderá con un presupuesto o con lo que necesite aclarar. Nada se contrata hasta que aceptes un presupuesto.
            </p>
          )}
          {submitError && <div className="mt-4"><FieldError>{submitError}</FieldError></div>}

          {/* Primary action. Inside the Request Hub, the hub's bottom row takes over (see hubAction). */}
          {!hubAction && (
          <div
            className={cx(
              'flex items-center justify-between gap-3',
              overlay ? 'sticky bottom-0 z-10 -mx-5 mt-auto bg-gradient-to-t from-paper from-70% to-transparent px-5 pb-1 pt-6 sm:-mx-6 sm:px-6' : 'mt-8 border-t border-line pt-6',
            )}
          >
            {step > 0 || (overlay && onBackFromStart) ? (
              overlay ? (
                <button
                  type="button"
                  onClick={() => (step > 0 ? goTo(step - 1) : onBackFromStart?.())}
                  aria-label="Atrás"
                  className="float-pill flex size-14 shrink-0 items-center justify-center rounded-full text-ink active:scale-95"
                >
                  <ArrowLeft className="size-5" aria-hidden />
                </button>
              ) : (
                <Button variant="ghost" onClick={() => goTo(step - 1)} icon={<ArrowLeft className="size-4" aria-hidden />}>
                  Atrás
                </Button>
              )
            ) : (
              <span />
            )}
            {step < LAST_STEP ? (
              <Button onClick={next} size="lg" className={cx(overlay && 'h-14 flex-1 text-[17px]')} icon={<ArrowRight className="order-last size-5" aria-hidden />}>
                Continuar
              </Button>
            ) : (
              <Button onClick={submit} size="lg" loading={submitting} disabled={submitting} className={cx(overlay && 'h-14 flex-1 text-[17px]')} icon={<Send className="size-4" aria-hidden />}>
                Enviar solicitud
              </Button>
            )}
          </div>
          )}
    </>
  );

  // In the panel the primary action stays pinned to the bottom, even on short steps.
  if (overlay) return <div ref={formRef} className="flex min-h-full flex-col pb-2">{body}</div>;
  return (
    <div ref={formRef} className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 max-w-2xl">{body}</div>
        <aside className="hidden lg:block">
          <div className="surface sticky top-24 p-5">
            <p className="font-bold">{recipients.length ? (recipients.length === 1 ? 'Se enviará a' : `Se enviará a ${recipients.length} mecánicos`) : 'Cómo funciona'}</p>
            {recipients.length > 0 && (
              <ul className="mt-3 space-y-2.5">
                {recipients.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} tone={m.avatarTone} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{m.name}</span>
                      <span className="block truncate text-xs text-muted">{m.businessName}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
              <li>1. Describes qué necesita tu bici.</li>
              <li>2. Eliges hasta {MAX_RECIPIENTS_PER_SEND} mecánicos compatibles.</li>
              <li>3. Comparas sus respuestas y contratas a uno.</li>
            </ul>
          </div>
        </aside>
    </div>
  );
}

/** /solicitar: the request form as its own focused screen (mechanic-first entry and deep links). */
export function RequestFlowPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useApp((s) => s.toast);
  const draft = useApp((s) => s.draft);
  const mechanic = useMechanic(params.get('mecanico') ?? draft.originMechanicId);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <div className="container-page py-6 sm:py-10">
      {/* Focused flow: no tab bar here, just back, close and progress. The draft is kept either way. */}
      <div className="mb-6 flex max-w-2xl items-center justify-between gap-3">
        <BackLink fallback={mechanic ? `/mecanicos/${mechanic.id}` : '/'}>{mechanic ? `Perfil de ${mechanic.name.split(' ')[0]}` : 'Volver'}</BackLink>
        <div ref={setSlot} className="min-w-0 max-w-sm flex-1" />
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
      <RequestForm
        variant="page"
        originMechanicId={params.get('mecanico') ?? undefined}
        params={params}
        progressSlot={slot}
        onSent={(sent) => navigate(`/solicitudes/${sent[0]!.caseId}/enviada`, { replace: true })}
      />
    </div>
  );
}
