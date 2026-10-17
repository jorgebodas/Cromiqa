import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { LOCATIONS } from '@/domain/catalog';
import { Button, Field, FieldError, Input, Select, cx } from '@/components/ui';
import { alreadySubmitted, isEmail, submitLead, type LeadKind } from './leads';

function useLead(kind: LeadKind) {
  const [done, setDone] = useState(() => alreadySubmitted(kind));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const send = async (fields: Record<string, string>, honeypot: string) => {
    setSending(true);
    setError(undefined);
    try {
      await submitLead(kind, fields, honeypot);
      setDone(true);
    } catch {
      setError('No hemos podido enviarlo. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };
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

function Success({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-sand p-5">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-[15px] text-muted">{children}</p>
      </div>
    </div>
  );
}

const PRIVACY = 'Solo usaremos tus datos para contactarte sobre Cromiqa. Puedes pedir que los borremos cuando quieras.';

export function WaitlistForm() {
  const { done, sending, error, send } = useLead('waitlist');
  const [email, setEmail] = useState('');
  const [zone, setZone] = useState('');
  const [honey, setHoney] = useState('');
  const [invalid, setInvalid] = useState<string>();

  if (done) return <Success title="¡Apuntado!">Te avisaremos en cuanto Cromiqa abra en tu zona.</Success>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setInvalid('Escribe un email válido.');
    setInvalid(undefined);
    void send({ email: email.trim(), zona: LOCATIONS.find((l) => l.id === zone)?.label ?? 'Sin indicar' }, honey);
  };

  return (
    <form onSubmit={submit} noValidate className="relative max-w-xl" aria-labelledby="waitlist-title" data-testid="waitlist-form">
      <h2 id="waitlist-title" className="text-sm font-semibold">
        Avísame cuando abra
      </h2>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="waitlist-email" className="sr-only">
            Tu email
          </label>
          <Input
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
        </div>
        <label htmlFor="waitlist-zone" className="sr-only">
          Tu zona
        </label>
        <Select id="waitlist-zone" value={zone} onChange={(e) => setZone(e.target.value)} className="sm:w-48">
          <option value="">Tu zona (opcional)</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <Button type="submit" className="h-12 px-6 text-base" loading={sending} icon={<ArrowRight className="order-last size-4" aria-hidden />}>
          Avísame
        </Button>
      </div>
      <Honeypot value={honey} onChange={setHoney} />
      {(invalid || error) && (
        <div className="mt-2">
          <FieldError id="waitlist-error">{invalid ?? error}</FieldError>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{PRIVACY}</p>
    </form>
  );
}

export function MechanicLeadForm() {
  const { done, sending, error, send } = useLead('mechanic');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: '', taller: '', zona: '', email: '', telefono: '', especialidad: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honey, setHoney] = useState('');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (done) return <Success title="¡Gracias!">Te escribiremos pronto para contarte cómo funcionará Cromiqa para mecánicos.</Success>;

  if (!open) {
    return (
      <Button variant="dark" size="lg" onClick={() => setOpen(true)} icon={<ArrowRight className="order-last size-4" aria-hidden />}>
        Quiero unirme
      </Button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.nombre.trim().length < 2) next.nombre = 'Escribe tu nombre.';
    if (!form.zona) next.zona = 'Elige tu zona principal.';
    if (!isEmail(form.email)) next.email = 'Escribe un email válido.';
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

  return (
    <form onSubmit={submit} noValidate className={cx('relative grid grid-cols-1 gap-4 sm:grid-cols-2', 'animate-fade-in')} data-testid="mechanic-form">
      <Field label="Nombre" error={errors.nombre}>
        <Input name="nombre" autoComplete="name" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} />
      </Field>
      <Field label="Taller o negocio" optional>
        <Input name="taller" autoComplete="organization" value={form.taller} onChange={(e) => set({ taller: e.target.value })} />
      </Field>
      <Field label="Email" error={errors.email}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <Field label="Teléfono" optional>
        <Input name="telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={(e) => set({ telefono: e.target.value })} />
      </Field>
      <Field label="Zona principal" error={errors.zona}>
        <Select name="zona" value={form.zona} onChange={(e) => set({ zona: e.target.value })}>
          <option value="">Elige tu zona</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Especialidad" optional hint="Ej.: MTB y suspensiones, eléctricas, carretera…">
        <Input name="especialidad" value={form.especialidad} onChange={(e) => set({ especialidad: e.target.value })} />
      </Field>
      <Honeypot value={honey} onChange={setHoney} />
      <div className="sm:col-span-2">
        {error && (
          <div className="mb-3">
            <FieldError>{error}</FieldError>
          </div>
        )}
        <Button type="submit" variant="dark" size="lg" loading={sending}>
          Enviar
        </Button>
        <p className="mt-3 text-xs text-muted">{PRIVACY}</p>
      </div>
    </form>
  );
}
