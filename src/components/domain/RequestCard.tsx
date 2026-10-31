import { Link } from 'react-router-dom';
import { Bike, ChevronRight } from 'lucide-react';
import type { ServiceRequest } from '@/domain/types';
import { STATUSES, bikeTypeLabel, categoryLabel, locationShort, modeLabel } from '@/domain/catalog';
import { currentProposal } from '@/domain/logic/requests';
import { formatDate, formatPrice, relativeTime } from '@/domain/utils';
import { StatusBadge } from './Status';
import { cx } from '@/components/ui';

export function RequestCard({
  request,
  href,
  counterpart,
  perspective,
}: {
  request: ServiceRequest;
  href: string;
  counterpart: string;
  perspective: 'owner' | 'mechanic';
}) {
  const proposal = currentProposal(request);
  const needsMe =
    (perspective === 'owner' && request.status === 'proposal_received') ||
    (perspective === 'mechanic' && (request.status === 'sent' || request.status === 'awaiting_proposal'));
  return (
    <Link
      to={href}
      className={cx(
        'surface group block p-4 sm:p-5',
        needsMe && 'ring-2 ring-ink',
      )}
      data-testid="request-card"
      data-request-id={request.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {request.code} · {relativeTime(request.updatedAt)}
          </p>
          <h3 className="mt-1 font-bold leading-snug">{categoryLabel(request.category)}</h3>
        </div>
        <StatusBadge status={request.status} className="shrink-0" />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{request.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Bike className="size-4 text-muted" aria-hidden />
          {request.bike.brand} {request.bike.model}
          <span className="text-muted">· {bikeTypeLabel(request.bike.type)}</span>
        </span>
        <span>{perspective === 'owner' ? `Con ${counterpart}` : counterpart}</span>
        <span className="text-muted">
          {modeLabel(request.mode)} · {locationShort(request.location)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="text-muted">
          {proposal && ['proposal_received', 'confirmed', 'in_progress', 'completed'].includes(request.status) ? (
            <>
              <span className="font-semibold text-ink">{formatPrice(proposal.price)}</span> · {formatDate(proposal.date, { weekday: 'short', day: 'numeric', month: 'short' })} a las {proposal.time}
            </>
          ) : perspective === 'owner' ? (
            STATUSES[request.status].ownerHint
          ) : (
            STATUSES[request.status].mechanicHint
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
