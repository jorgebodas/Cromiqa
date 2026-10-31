import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Award, CalendarDays, Clock, Languages, MapPin, Store, UserRoundX } from 'lucide-react';
import { CATEGORIES, TIME_SLOTS, WEEKDAYS, bikeTypeLabel, locationLabel, locationShort, specializationLabel } from '@/domain/catalog';
import { formatDate, formatLongDate, formatPrice } from '@/domain/utils';
import { useApp } from '@/state/store';
import { useCurrentUser, useMechanic, useMechanicRating } from '@/state/selectors';
import { DemoVerifiedBadge, ModeIndicators } from '@/components/domain/MechanicCard';
import { Avatar, Badge, Card, DemoTag, EmptyState, LinkButton, Rating, SectionTitle, Stars, cx } from '@/components/ui';
import { CATEGORY_ICONS } from './startRequest';
import { ScreenHeader } from '@/components/layout/ScreenHeader';

export function MechanicProfilePage() {
  const { id } = useParams();
  const mechanic = useMechanic(id);
  const { rating, reviewCount } = useMechanicRating(id);
  const allReviews = useApp((s) => s.db.reviews);
  const user = useCurrentUser();

  if (!mechanic) {
    return (
      <div className="container-page py-12">
        <EmptyState
          as="h1"
          icon={<UserRoundX className="size-6" />}
          title="No encontramos este perfil"
          description="Puede que el enlace no sea correcto o que los datos de la demo se hayan restablecido."
          action={<LinkButton to="/mecanicos" variant="dark">Ver mecánicos</LinkButton>}
        />
      </div>
    );
  }

  const m = mechanic;
  const reviews = allReviews.filter((r) => r.mechanicId === m.id).sort((a, b) => b.date.localeCompare(a.date));
  const isSelf = user?.mechanicId === m.id;
  const requestHref = `/solicitar?mecanico=${m.id}`;
  const servicesByCategory = CATEGORIES.map((c) => ({ ...c, services: m.services.filter((s) => s.category === c.id) })).filter((c) => c.services.length);

  return (
    <div className="pb-28 lg:pb-0">
      <ScreenHeader title={m.name} back="/mecanicos" />
      <div className="border-b border-line bg-sand">
        <div className="container-page py-6 sm:py-10">
          {isSelf && (
            <p className="mb-5 rounded-2xl border border-ink bg-paper px-4 py-3 text-sm">
              Así ven los clientes tu perfil público. <Link to="/pro/perfil" className="font-semibold underline">Editar perfil</Link>
            </p>
          )}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={m.name} tone={m.avatarTone} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{m.businessName}</p>
              <p className="mt-1 text-lg font-semibold">{m.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Rating rating={rating} count={reviewCount} />
                <DemoVerifiedBadge verified={m.demoVerified} />
              </div>
            </div>
            {!isSelf && (
              <div className="hidden lg:block">
                <LinkButton to={requestHref} size="lg" icon={<ArrowRight className="order-last size-5" aria-hidden />}>
                  Solicitar servicio
                </LinkButton>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-page grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="about">
            <SectionTitle id="about">Sobre {m.name.split(' ')[0]}</SectionTitle>
            <p className="max-w-2xl text-[17px] leading-relaxed">{m.bio}</p>
            <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-sand p-4">
                <dt className="flex items-center gap-1.5 text-sm text-muted"><Award className="size-4" aria-hidden /> Experiencia</dt>
                <dd className="mt-1 font-display text-2xl font-extrabold">{m.yearsExperience} años</dd>
              </div>
              <div className="rounded-2xl bg-sand p-4">
                <dt className="flex items-center gap-1.5 text-sm text-muted"><Clock className="size-4" aria-hidden /> Respuesta</dt>
                <dd className="mt-1 font-medium">{m.responseTime}</dd>
              </div>
              <div className="rounded-2xl bg-sand p-4">
                <dt className="flex items-center gap-1.5 text-sm text-muted"><Languages className="size-4" aria-hidden /> Idiomas</dt>
                <dd className="mt-1 font-medium">{m.languages.join(', ')}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="specs">
            <SectionTitle id="specs">Especialidades</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {m.specializations.map((s, i) => (
                <Badge key={s} tone={i === 0 ? 'ink' : 'neutral'} className="px-3 py-1.5 text-sm">
                  {specializationLabel(s)}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted">Trabaja con: {m.bikeTypes.map(bikeTypeLabel).join(' · ')}</p>
          </section>

          <section aria-labelledby="services">
            <SectionTitle id="services">Servicios y precios orientativos</SectionTitle>
            <div className="space-y-6">
              {servicesByCategory.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                return (
                  <div key={c.id}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                      <Icon className="size-4" aria-hidden /> {c.label}
                    </h3>
                    <ul className="divide-y divide-line rounded-2xl border border-line">
                      {c.services.map((s) => (
                        <li key={s.id} className="flex items-start justify-between gap-4 p-4">
                          <div>
                            <p className="font-semibold">{s.name}</p>
                            <p className="mt-0.5 text-sm text-muted">{s.description}</p>
                            {s.durationMinutes && <p className="mt-1 text-xs text-muted">≈ {s.durationMinutes} min</p>}
                          </div>
                          <p className="shrink-0 text-right">
                            {s.priceFrom === undefined ? (
                              <span className="text-sm text-muted">A consultar</span>
                            ) : s.priceFrom === 0 ? (
                              <span className="font-bold">Gratis</span>
                            ) : (
                              <>
                                <span className="block text-xs text-muted">desde</span>
                                <span className="font-bold">{formatPrice(s.priceFrom)}</span>
                              </>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              Precios ficticios de demostración. El precio final llega en la propuesta del mecánico y solo se confirma si la aceptas.
              {m.homeService && m.homeServiceFee !== undefined && (m.homeServiceFee > 0 ? ` Desplazamiento a domicilio: ${formatPrice(m.homeServiceFee)}.` : ' Desplazamiento a domicilio incluido.')}
            </p>
          </section>

          <section aria-labelledby="portfolio">
            <SectionTitle id="portfolio">Trabajos anteriores</SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {m.portfolio.map((p) => (
                <li key={p.id} className="rounded-2xl border border-line p-5">
                  <Badge tone="outline">{bikeTypeLabel(p.bikeType)}</Badge>
                  <h3 className="mt-3 font-bold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.description}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted"><DemoTag /> Casos de ejemplo inventados.</p>
          </section>

          <section aria-labelledby="reviews">
            <SectionTitle id="reviews" action={<DemoTag>Reseñas de demo</DemoTag>}>
              Opiniones ({reviewCount})
            </SectionTitle>
            {reviews.length === 0 ? (
              <p className="text-muted">Todavía no tiene opiniones.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.authorName} size="sm" />
                        <div>
                          <p className="text-sm font-semibold">{r.authorName}</p>
                          <p className="text-xs text-muted">{r.service} · {formatDate(r.date, { month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed">{r.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-bold">Zona y modalidad</h2>
            <div className="mt-3">
              <ModeIndicators home={m.homeService} workshop={m.workshop} />
            </div>
            {m.workshop && m.workshopArea && (
              <p className="mt-3 flex items-start gap-2 text-sm"><Store className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />{m.workshopArea}</p>
            )}
            <p className="mt-3 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <span>Base en {locationLabel(m.baseLocation)}</span>
            </p>
            {m.homeService && (
              <div className="mt-3">
                <p className="text-sm text-muted">Se desplaza a:</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {m.serviceAreas.map((a) => (
                    <li key={a}><Badge>{locationShort(a)}</Badge></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold">Disponibilidad</h2>
            {m.nextAvailableDate && (
              <p className="mt-3 flex items-start gap-2 text-sm">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span>Próximo hueco: <strong className="font-semibold">{formatLongDate(m.nextAvailableDate)}</strong></span>
              </p>
            )}
            <table className="mt-4 w-full text-center text-xs">
              <caption className="sr-only">Franjas habituales por día</caption>
              <thead>
                <tr>
                  <th className="w-20" />
                  {WEEKDAYS.map((d) => (
                    <th key={d.id} scope="col" className="pb-1.5 font-medium text-muted"><abbr title={d.label} className="no-underline">{d.short}</abbr></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot.id}>
                    <th scope="row" className="py-1 text-left font-medium text-muted">{slot.label}</th>
                    {WEEKDAYS.map((d) => {
                      const on = m.weeklyAvailability.find((w) => w.day === d.id)?.slots.includes(slot.id);
                      return (
                        <td key={d.id} className="p-0.5">
                          <span className={cx('block h-5 rounded-md', on ? 'bg-ink' : 'bg-sand')} />
                          <span className="sr-only">{on ? 'Disponible' : 'No disponible'}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm text-muted">{m.availabilityNote}</p>
          </Card>

          {!isSelf && (
            <Card className="hidden p-5 lg:block">
              <p className="text-sm text-muted">Envía tu caso y {m.name.split(' ')[0]} te responderá con precio y cita. No pagas nada por solicitar.</p>
              <LinkButton to={requestHref} block variant="dark" className="mt-4">
                Solicitar servicio
              </LinkButton>
            </Card>
          )}
          <p className="text-xs text-muted">Perfil ficticio para el entorno de demostración. No acepta reservas reales.</p>
        </aside>
      </div>

      {!isSelf && (
        // Cyclists see no tab bar on this screen (its main action is this button); mechanics keep theirs.
        <div
          className={cx(
            'fixed inset-x-0 z-30 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden',
            user?.role === 'mechanic' ? 'bottom-16' : 'bottom-0 pb-[max(12px,env(safe-area-inset-bottom))]',
          )}
        >
          <LinkButton to={requestHref} block size="lg">
            Solicitar servicio a {m.name.split(' ')[0]}
          </LinkButton>
        </div>
      )}
    </div>
  );
}
