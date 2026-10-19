import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '@/state/store';
import { cx } from './cx';

export function Toaster() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = t.tone === 'error' ? XCircle : t.tone === 'info' ? Info : CheckCircle2;
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="animate-toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-pop"
          >
            <Icon className={cx('size-5 shrink-0', t.tone === 'error' ? 'text-red-300' : 'text-lime')} aria-hidden />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar aviso"
              className="rounded-full p-1 text-paper/70 hover:text-paper focus-visible:outline-2 focus-visible:outline-lime"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
