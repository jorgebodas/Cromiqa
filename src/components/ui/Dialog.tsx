import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { cx } from './cx';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** Bottom sheet on phones: shows a grab handle and closes when dragged down. */
  sheet?: boolean;
  /** Phones: slide down from the top instead (keeps a text field clear of the keyboard). */
  placement?: 'bottom' | 'top';
}

/** Accessible modal: focus moves in, Escape closes, focus is trapped and restored. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', sheet = false, placement = 'bottom' }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const onTouchStart = (e: TouchEvent) => {
    dragStart.current = e.touches[0]!.clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (dragStart.current !== null) setDrag(Math.max(0, e.touches[0]!.clientY - dragStart.current));
  };
  const onTouchEnd = () => {
    dragStart.current = null;
    if (drag > 90) onClose();
    setDrag(0);
  };
  const dragHandlers = sheet ? { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd } : {};

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
    (focusables()[1] ?? focusables()[0] ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const els = focusables();
        if (!els.length) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex justify-center sm:items-center sm:p-4', placement === 'top' ? 'items-start' : 'items-end')}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className={cx(
          'animate-fade-in relative flex max-h-[92dvh] w-full flex-col bg-paper shadow-pop sm:rounded-3xl',
          placement === 'top' ? 'rounded-b-3xl pt-[env(safe-area-inset-top)]' : 'rounded-t-3xl',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
          sheet && 'pb-[env(safe-area-inset-bottom)] sm:pb-0',
        )}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : { transition: 'transform 200ms ease-out' }}
      >
        {sheet && placement === 'bottom' && (
          <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden {...dragHandlers}>
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </div>
        )}
        <div className={cx('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', sheet && placement === 'bottom' && 'pt-3')} {...(placement === 'bottom' ? dragHandlers : {})}>
          <div>
            <h2 id="dialog-title" className="text-xl font-bold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <IconButton label="Cerrar" onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
