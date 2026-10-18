import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { LOCATIONS } from '@/domain/catalog';
import { FieldError, Input, Select, cx } from '@/components/ui';
import { DuplicateLeadError, isEmail, submitLead, type LeadKind } from './leads';

export interface LeadFormState {
  sending: boolean;
  done: boolean;
}

interface LeadFormProps {
  autoFocus?: boolean;
  /** The submit button lives outside the form (in the dock), linked through this id. */
  formId: string;
  onState?: (state: LeadFormState) => void;
}

function useLead(kind: LeadKind, onState?: (s: LeadFormState) => void) {
  // Success lasts for this form only: the next open starts empty, so many people can sign up.
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const send = async (fields: Record<string, string> & { email: string }, honeypot: string) => {
    setSending(true);
    setError(undefined);
    try {
      await submitLead(kind, fields, honeypot);
      navigator.vibrate?.(12);
      setDone(true);
    } catch (err) {
      setError(err instanceof DuplicateLeadError ? err.message : 'No hemos podido enviarlo. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };
  useEffect(() => onState?.({ sending, done }), [sending, done]); // eslint-disable-line react-hooks/exhaustive-deps
  return { done, sending, error, send };
}

/** Invisible field that only bots fill in. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
      <label>
        No rellenar
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} name="_honey" />
      </label>
    </div>
  );
}

/** Staggered entrance for each form row. */
const rise = (i: number): CSSProperties => ({ animationDelay: `${60 + i * 55}ms` });

/** Brand check drawn in lime on ink, with a small burst — the "QA" moment. */
function Success({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center px-2 py-4 text-center">
      <span className="relative flex size-16 items-center justify-center" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="cq-burst absolute size-1.5 rounded-full bg-lime ring-1 ring-ink/70" style={{ '--a': `${i * 45}deg` } as CSSProperties} />
        ))}
        <span className="cq-pop flex size-16 items-center justify-center rounded-full bg-ink">
          <svg viewBox="0 0 48 48" className="size-9">
            <path d="M13 25 L21 33 L36 16" fill="none" stroke="#C7FF2F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="cq-draw" />
          </svg>
        </span>
      </span>
      <p className="cq-rise mt-4 font-display text-xl font-extrabold" style={rise(4)}>
        {title}
      </p>
      <p className="cq-rise mt-1 max-w-xs text-[15px] text-muted" style={rise(5)}>
        {children}
      </p>
    </div>
  );
}

const PRIVACY = 'Solo usaremos tus datos para contactarte sobre Cromiqa. Puedes pedir que los borremos cuando quieras.';

function Privacy({ i }: { i: number }) {
  return (
    <p className="cq-rise mt-5 text-center text-[11px] leading-snug text-muted" style={rise(i)}>
      {PRIVACY}
    </p>
  );
}

function useAutoFocus<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!enabled) return;
    // Wait for the dock to start expanding so the page doesn't jump on mobile.
    const t = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 220);
    return () => window.clearTimeout(t);
  }, [enabled]);
  return ref;
}

export function WaitlistForm({ autoFocus = false, formId, onState }: LeadFormProps) {
  const { done, error, send } = useLead('waitlist', onState);
  const [email, setEmail] = useState('');
  const [zone, setZone] = useState('');
  const [honey, setHoney] = useState('');
  const [invalid, setInvalid] = useState<string>();
  const emailRef = useAutoFocus<HTMLInputElement>(autoFocus && !done);

  if (done) return <Success title="¡Estás dentro!">Te avisaremos en cuanto Cromiqa abra en tu zona.</Success>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setInvalid('Escribe un email válido.');
    setInvalid(undefined);
    void send({ email: email.trim(), zona: LOCATIONS.find((l) => l.id === zone)?.label ?? 'Sin indicar' }, honey);
  };

  return (
    <form id={formId} onSubmit={submit} noValidate className="relative" data-testid="waitlist-form">
      <h2 className="cq-rise font-display text-xl font-extrabold leading-tight tracking-tight" style={rise(0)}>
        Apúntate a la lista de espera
      </h2>
      <div className="cq-rise mt-6 space-y-3" style={rise(2)}>
        <label htmlFor="waitlist-email" className="sr-only">
          Tu email
        </label>
        <Input
          ref={emailRef}
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setInvalid(undefined);
          }}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? 'waitlist-error' : undefined}
        />
        <label htmlFor="waitlist-zone" className="sr-only">
          Tu zona
        </label>
        <Select id="waitlist-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">Tu zona (opcional)</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
      <Honeypot value={honey} onChange={setHoney} />
      {(invalid || error) && (
        <div className="mt-3">
          <FieldError id="waitlist-error">{invalid ?? error}</FieldError>
        </div>
      )}
      <Privacy i={3} />
    </form>
  );
}

export function MechanicLeadForm({ autoFocus = false, formId, onState }: LeadFormProps) {
  const { done, error, send } = useLead('mechanic', onState);
  const [form, setForm] = useState({ nombre: '', taller: '', zona: '', email: '', telefono: '', especialidad: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honey, setHoney] = useState('');
  const nameRef = useAutoFocus<HTMLInputElement>(autoFocus && !done);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (done) return <Success title="¡Gracias!">Te escribiremos pronto para contarte cómo funcionará Cromiqa para mecánicos.</Success>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.nombre.trim().length < 2) next.nombre = 'Escribe tu nombre.';
    if (!isEmail(form.email)) next.email = 'Escribe un email válido.';
    if (!form.zona) next.zona = 'Elige tu zona principal.';
    setErrors(next);
    if (Object.keys(next).length) return;
    void send(
      {
        nombre: form.nombre.trim(),
        taller: form.taller.trim() || '—',
        zona: LOCATIONS.find((l) => l.id === form.zona)?.label ?? form.zona,
        email: form.email.trim(),
        telefono: form.telefono.trim() || '—',
        especialidad: form.especialidad.trim() || '—',
      },
      honey,
    );
  };

  const field = (key: keyof typeof form, label: string, input: ReactNode, i: number, className?: string) => (
    <div className={cx('cq-rise', className)} style={rise(i)}>
      <label htmlFor={`m-${key}`} className="sr-only">
        {label}
      </label>
      {input}
      {errors[key] && (
        <div className="mt-1">
          <FieldError>{errors[key]}</FieldError>
        </div>
      )}
    </div>
  );

  return (
    <form id={formId} onSubmit={submit} noValidate className="relative" data-testid="mechanic-form">
      <h2 className="cq-rise font-display text-xl font-extrabold leading-tight tracking-tight" style={rise(0)}>
        Únete a Cromiqa como mecánico
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {field('nombre', 'Nombre', <Input ref={nameRef} id="m-nombre" name="nombre" autoComplete="name" placeholder="Nombre" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} aria-invalid={errors.nombre ? true : undefined} />, 2)}
        {field('taller', 'Taller (opcional)', <Input id="m-taller" name="taller" autoComplete="organization" placeholder="Taller (opc.)" value={form.taller} onChange={(e) => set({ taller: e.target.value })} />, 2)}
        {field('email', 'Email', <Input id="m-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={errors.email ? true : undefined} />, 3, 'col-span-2')}
        {field(
          'zona',
          'Zona principal',
          <Select id="m-zona" name="zona" value={form.zona} onChange={(e) => set({ zona: e.target.value })} aria-invalid={errors.zona ? true : undefined}>
            <option value="">Tu zona</option>
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>,
          4,
        )}
        {field('telefono', 'Teléfono (opcional)', <Input id="m-telefono" name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="Teléfono (opc.)" value={form.telefono} onChange={(e) => set({ telefono: e.target.value })} />, 4)}
        {field('especialidad', 'Especialidad (opcional)', <Input id="m-especialidad" name="especialidad" placeholder="Especialidad (opc.): MTB, eléctricas…" value={form.especialidad} onChange={(e) => set({ especialidad: e.target.value })} />, 5, 'col-span-2')}
      </div>
      <Honeypot value={honey} onChange={setHoney} />
      {error && (
        <div className="mt-2">
          <FieldError>{error}</FieldError>
        </div>
      )}
      <Privacy i={6} />
    </form>
  );
}
