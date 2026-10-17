import { Check } from 'lucide-react';
import type { RequestStatus } from '@/domain/types';
import { STATUSES } from '@/domain/catalog';
import { cx } from '@/components/ui';

const toneClass: Record<(typeof STATUSES)[RequestStatus]['tone'], string> = {
  neutral: 'bg-sand text-ink',
  waiting: 'bg-sand text-ink',
  action: 'bg-lime text-ink', // the one status that needs the owner's action
  positive: 'bg-ink text-paper',
  progress: 'bg-ink text-paper',
  done: 'border border-ink text-ink bg-paper',
  muted: 'bg-sand-deep text-muted',
};

const dotClass: Record<(typeof STATUSES)[RequestStatus]['tone'], string> = {
  neutral: 'bg-muted',
  waiting: 'bg-muted animate-pulse',
  action: 'bg-ink',
  positive: 'bg-lime',
  progress: 'bg-lime animate-pulse',
  done: 'bg-ink',
  muted: 'bg-subtle',
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const s = STATUSES[status];
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none', toneClass[s.tone], className)}
      data-status={status}
    >
      <span className={cx('size-1.5 rounded-full', dotClass[s.tone])} aria-hidden />
      {s.label}
    </span>
  );
}

const STEPS: { label: string; statuses: RequestStatus[] }[] = [
  { label: 'Enviada', statuses: ['sent'] },
  { label: 'Valorando', statuses: ['awaiting_proposal'] },
  { label: 'Propuesta', statuses: ['proposal_received'] },
  { label: 'Confirmada', statuses: ['confirmed'] },
  { label: 'En curso', statuses: ['in_progress'] },
  { label: 'Completada', statuses: ['completed'] },
];

/** Horizontal progress through the lifecycle. */
export function StatusProgress({ status }: { status: RequestStatus }) {
  if (status === 'cancelled') return null;
  const current = STATUSES[status].step;
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Progreso de la solicitud">
      {STEPS.map((step, i) => {
        const done = i < current || status === 'completed';
        const active = i === current && status !== 'completed';
        return (
          <li key={step.label} className="flex flex-col gap-1.5" aria-current={active ? 'step' : undefined}>
            <span className={cx('h-1.5 rounded-full', done ? 'bg-ink' : active ? 'bg-lime' : 'bg-line')} />
            <span className={cx('hidden text-[11px] sm:flex sm:items-center sm:gap-1', done || active ? 'font-medium text-ink' : 'text-muted')}>
              {done && <Check className="size-3" aria-hidden />}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
