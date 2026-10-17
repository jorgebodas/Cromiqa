import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CircleHelp, ClipboardCheck, MessagesSquare, ScanSearch, ShieldCheck, Wrench, Settings2 } from 'lucide-react';
import type { BikeType, LocationId, ServiceCategory, ServiceMode } from '@/domain/types';
import { BIKE_TYPES, CATEGORIES, LOCATIONS } from '@/domain/catalog';
import { searchMechanics } from '@/domain/logic/search';
import { useApp } from '@/state/store';
import { useCurrentUser } from '@/state/selectors';
import { useSwitchAccount } from '@/components/layout/AccountSwitcher';
import { Avatar, Button, ChoiceCard, Field, FieldError, Rating, Select, Textarea, cx } from '@/components/ui';
import { buildSearchParams } from './searchParams';

export const CATEGORY_ICONS: Record<ServiceCategory, typeof Wrench> = {
  repair: Wrench,
  maintenance: Settings2,
  inspection: ScanSearch,
  diagnosis: CircleHelp,
};

const PLACEHOLDERS: Record<ServiceCategory, string> = {
  repair: 'Ej.: los cambios saltan al subir y la cadena hace ruido en los piñones grandes.',
  maintenance: 'Ej.: hace un año que no la reviso y quiero ponerla a punto antes del verano.',
  inspection: 'Ej.: voy a comprar una MTB usada a un particular y quiero revisarla antes de pagar.',
  diagnosis: 'Ej.: oigo un clic al pedalear, pero no sé de dónde viene.',
};

export function HomePage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const resetDraft = useApp((s) => s.resetDraft);
  const mechanics = useApp((s) => s.db.mechanics);
  const reviews = useApp((s) => s.db.reviews);
  const switchAccount = useSwitchAccount();

  const [category, setCategory] = useState<ServiceCategory | undefined>();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationId | ''>(user?.role === 'owner' ? user.location : '');
  const [mode, setMode] = useState<ServiceMode | ''>('');
  const [bikeType, setBikeType] = useState<BikeType | ''>('');
  const [error, setError] = useState<string | null>(null);

  const featured = useMemo(() => searchMechanics(mechanics, reviews, { sort: 'rating' }).slice(0, 3), [mechanics, reviews]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError('Elige qué necesita tu bici para continuar.');
      document.getElementById('need-category')?.focus();
      return;
    }
    resetDraft({
      category,
      description,
      location: location || undefined,
      mode: mode || undefined,
      bike: { type: bikeType || undefined, brand: '', model: '', name: '', notes: '' },
    });
    navigate(`/mecanicos?${buildSearchParams({ category, location: location || undefined, mode: mode || undefined, bikeType: bikeType || undefined, fromHome: true })}`);
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-sand">
        <div className="container-page grid grid-cols-1 gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-start lg:gap-14 lg:py-20">
          <div className="max-w-xl lg:pt-8">
            <p className="eyebrow mb-4">Mecánicos de bici en el sureste de Madrid</p>
            <h1 className="text-[2.75rem] font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
              Tu bici, en buenas manos.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              Encuentra mecánicos de confianza cerca de ti. Reparaciones, mantenimiento e inspecciones, sin complicaciones.
            </p>
            <ul className="mt-8 hidden space-y-3 text-[15px] lg:block">
              {[
                'Empiezas por el problema, no por una lista interminable.',
                'Precios orientativos visibles antes de pedir nada.',
                'Nada se reserva hasta que aceptas una propuesta.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <form
            onSubmit={submit}
            noValidate
            className="rounded-3xl border border-line bg-paper p-5 shadow-card sm:p-7"
            aria-labelledby="need-title"
          >
            <h2 id="need-title" className="text-2xl font-extrabold sm:text-[28px]">
              ¿Qué necesita tu bici?
            </h2>
            <fieldset className="mt-5" aria-describedby={error ? 'need-error' : undefined}>
              <legend className="sr-only">Tipo de servicio</legend>
              <div id="need-category" tabIndex={-1} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c.id];
                  return (
                    <ChoiceCard
                      key={c.id}
                      name="category"
                      value={c.id}
                      selected={category === c.id}
                      onSelect={() => {
                        setCategory(c.id);
                        setError(null);
                      }}
                      icon={<Icon className="size-5" />}
                      title={c.label}
                      className="p-3.5"
                    />
                  );
                })}
              </div>
              {error && (
                <div className="mt-2">
                  <FieldError id="need-error">{error}</FieldError>
                </div>
              )}
            </fieldset>

            <div className={cx('grid transition-all', category ? 'mt-5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden">
                <Field label="Cuéntanos qué le pasa" optional hint="Cuanto más concreto, mejor encajará el mecánico.">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={category ? PLACEHOLDERS[category] : ''}
                    rows={3}
                    tabIndex={category ? 0 : -1}
                    name="description"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="¿Dónde?">
                <Select value={location} onChange={(e) => setLocation(e.target.value as LocationId | '')} name="location">
                  <option value="">Cualquier zona</option>
                  {LOCATIONS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de bici">
                <Select value={bikeType} onChange={(e) => setBikeType(e.target.value as BikeType | '')} name="bikeType">
                  <option value="">Cualquiera</option>
                  {BIKE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium">¿Cómo lo prefieres?</legend>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1" role="radiogroup">
                {([
                  ['', 'Me da igual'],
                  ['home', 'A domicilio'],
                  ['workshop', 'En taller'],
                ] as const).map(([value, label]) => (
                  <label
                    key={value}
                    className={cx(
                      'flex h-10 cursor-pointer items-center justify-center rounded-xl text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink',
                      mode === value ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink',
                    )}
                  >
                    <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" size="lg" block className="mt-6" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
              Buscar mecánicos
            </Button>
            <p className="mt-3 text-center text-xs text-muted">Sin registro para explorar. Sin compromiso.</p>
          </form>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20" aria-labelledby="how-title">
        <p className="eyebrow mb-3">Cómo funciona</p>
        <h2 id="how-title" className="max-w-xl text-3xl font-extrabold sm:text-4xl">
          De “algo no va bien” a bici lista, en tres pasos.
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: MessagesSquare, title: 'Cuéntanos qué necesita', text: 'Elige el tipo de servicio y describe el problema con tus palabras. Si no sabes qué es, también vale.' },
            { icon: ScanSearch, title: 'Elige a tu mecánico', text: 'Compara especialidad, zona, domicilio o taller y precios orientativos. Envía tu solicitud a quien encaje.' },
            { icon: ClipboardCheck, title: 'Recibe una propuesta y decide', text: 'El mecánico te propone precio y cita. Solo se confirma si la aceptas. Después, queda en tu garaje.' },
          ].map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-line p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-sand" aria-hidden>
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-sm font-bold text-subtle">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-sand/60" aria-labelledby="featured-title">
        <div className="container-page py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3">Profesionales de la demo</p>
              <h2 id="featured-title" className="text-2xl font-extrabold sm:text-3xl">
                Mecánicos mejor valorados
              </h2>
            </div>
            <Link to="/mecanicos" className="hidden items-center gap-1 text-sm font-semibold hover:underline sm:inline-flex">
              Ver todos <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {featured.map(({ mechanic: m, rating, reviewCount }) => (
              <li key={m.id}>
                <Link to={`/mecanicos/${m.id}`} className="flex h-full flex-col rounded-3xl border border-line bg-paper p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} tone={m.avatarTone} />
                    <div className="min-w-0">
                      <p className="font-bold">{m.name}</p>
                      <p className="truncate text-sm text-muted">{m.businessName}</p>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 text-[15px]">{m.headline}</p>
                  <div className="mt-4">
                    <Rating rating={rating} count={reviewCount} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/mecanicos" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold hover:underline sm:hidden">
            Ver todos los mecánicos <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="pro-title">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-ink p-7 text-paper sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 id="pro-title" className="text-2xl font-extrabold">¿Eres mecánico?</h2>
            <p className="mt-2 max-w-lg text-paper/70">
              Recibe solicitudes claras, con la bici y el problema descritos, y responde con tu precio y tu agenda.
            </p>
          </div>
          <button
            type="button"
            onClick={() => switchAccount('u-carlos', { to: '/pro' })}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-paper/30 px-5 text-[15px] font-semibold hover:border-paper focus-visible:outline-2 focus-visible:outline-lime"
          >
            Probar el panel de mecánico (demo) <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </section>
    </>
  );
}
