import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, Home, MapPin, Store } from 'lucide-react';
import type { MechanicResult } from '@/domain/logic/search';
import { locationShort, specializationLabel } from '@/domain/catalog';
import { formatDate, formatPrice } from '@/domain/utils';
import { Avatar, Badge, DemoTag, Rating, buttonClass, cx } from '@/components/ui';

export function ModeIndicators({ home, workshop, compact }: { home: boolean; workshop: boolean; compact?: boolean }) {
  const item = (on: boolean, Icon: typeof Home, label: string) => (
    <span className={cx('inline-flex items-center gap-1.5 text-sm', on ? 'text-ink' : 'text-subtle line-through')}>
      <Icon className="size-4" aria-hidden />
      {label}
      <span className="sr-only">{on ? ': disponible' : ': no disponible'}</span>
    </span>
  );
  return (
    <span className={cx('flex flex-wrap gap-x-4 gap-y-1', compact && 'gap-x-3')}>
      {item(home, Home, 'A domicilio')}
      {item(workshop, Store, 'En taller')}
    </span>
  );
}

export function DemoVerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink" title="Estado ficticio de demostración. Cromiqa no ha verificado a ningún profesional real.">
      <BadgeCheck className="size-4" aria-hidden />
      Perfil revisado
      <DemoTag>Ficticio</DemoTag>
    </span>
  );
}

export function MechanicCard({ result, requestHref }: { result: MechanicResult; requestHref: string }) {
  const { mechanic: m, rating, reviewCount, priceFrom, distanceKm, coversLocation, matchedSpecializations } = result;
  return (
    <article className="group rounded-3xl border border-line bg-paper p-5 transition-shadow hover:shadow-card sm:p-6" data-testid="mechanic-card">
      <div className="flex gap-4">
        <Avatar name={m.name} tone={m.avatarTone} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-tight">
                <Link to={`/mecanicos/${m.id}`} className="hover:underline focus-visible:underline">
                  {m.name}
                </Link>
              </h3>
              <p className="text-sm text-muted">{m.businessName}</p>
            </div>
            <Rating rating={rating} count={reviewCount} compact />
          </div>
          <p className="mt-2 font-medium">{m.headline}</p>
          <DemoVerifiedBadge verified={m.demoVerified} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {m.specializations.map((s) => (
          <Badge key={s} tone={matchedSpecializations.includes(s) ? 'ink' : 'neutral'}>
            {specializationLabel(s)}
          </Badge>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="sr-only">Ubicación</dt>
          <dd className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>
              Base en {locationShort(m.baseLocation)}
              {distanceKm !== undefined && (
                <span className="block text-xs text-muted">
                  {distanceKm === 0 ? 'En tu zona' : `≈ ${distanceKm} km entre zonas`}
                  {!coversLocation && ' · solo en taller'}
                </span>
              )}
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Modalidad</dt>
          <dd>
            <ModeIndicators home={m.homeService} workshop={m.workshop} compact />
          </dd>
        </div>
        <div>
          <dt className="sr-only">Disponibilidad</dt>
          <dd className="flex items-start gap-1.5">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>{m.nextAvailableDate ? `Próximo hueco: ${formatDate(m.nextAvailableDate, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Consultar agenda'}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {priceFrom !== undefined ? (
            <>
              <span className="text-muted">Desde </span>
              <span className="text-lg font-bold">{priceFrom === 0 ? 'Gratis' : formatPrice(priceFrom)}</span>
              <span className="text-muted"> · orientativo</span>
            </>
          ) : (
            <span className="text-muted">Precio a consultar</span>
          )}
        </p>
        <div className="flex gap-2">
          <Link to={`/mecanicos/${m.id}`} className={buttonClass('secondary', 'sm')}>
            Ver perfil
          </Link>
          <Link to={requestHref} className={buttonClass('dark', 'sm')} aria-label={`Solicitar servicio a ${m.name}`}>
            Solicitar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
