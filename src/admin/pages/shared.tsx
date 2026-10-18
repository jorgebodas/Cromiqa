import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
