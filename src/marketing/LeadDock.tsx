import { useEffect, useState } from 'react';
import { ArrowRight, Check, Wrench, X } from 'lucide-react';
import { cx } from '@/components/ui';
import { MechanicLeadForm, WaitlistForm } from './LeadForms';
import { alreadySubmitted, type LeadKind } from './leads';

/**
 * Floating bottom dock with the two calls to action. Choosing one grows the dock upwards
 * (springy height + staggered fields); choosing the other cross-fades the form.
 */
export function LeadDock() {
  const [open, setOpen] = useState<LeadKind | null>(null);
  // Keep the last form mounted while the dock collapses so it animates out smoothly.
  const [shown, setShown] = useState<LeadKind>('waitlist');
  const [openSeq, setOpenSeq] = useState(0);
  const [done, setDone] = useState(() => ({ waitlist: alreadySubmitted('waitlist'), mechanic: alreadySubmitted('mechanic') }));

  useEffect(() => {
    const onLead = (e: Event) => setDone((d) => ({ ...d, [(e as CustomEvent<LeadKind>).detail]: true }));
    window.addEventListener('cromiqa:lead', onLead);
    return () => window.removeEventListener('cromiqa:lead', onLead);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (kind: LeadKind) => {
    if (open === kind) return setOpen(null);
    setShown(kind);
    setOpen(kind);
    setOpenSeq((n) => n + 1);
  };

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(null)}
        className={cx(
          'fixed inset-0 z-20 bg-paper/50 backdrop-blur-[3px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div
          className={cx(
            'mx-auto max-w-md rounded-[28px] border border-line bg-paper/90 p-2 backdrop-blur-xl transition-shadow duration-500',
            open ? 'shadow-[0_24px_70px_-20px_rgb(23_23_23/0.35)]' : 'shadow-[0_12px_40px_-18px_rgb(23_23_23/0.3)]',
          )}
          data-testid="lead-dock"
        >
          <div
            id="lead-panel"
            role="region"
            aria-label={shown === 'waitlist' ? 'Lista de espera' : 'Registro para mecánicos'}
            className={cx(
              'grid transition-[grid-template-rows] duration-[520ms] ease-[cubic-bezier(.2,1.25,.32,1)]',
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
            {...(!open ? { inert: '' } : {})}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="relative max-h-[min(68dvh,560px)] overflow-y-auto px-3 pb-3 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Cerrar"
                  className="absolute right-1.5 top-1.5 z-10 flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-sand hover:text-ink"
                >
                  <X className="size-4" />
                </button>
                {/* key re-mounts the form on each open/switch so its entrance animation replays. */}
                <div key={`${shown}-${openSeq}`} className={cx('transition-opacity duration-200', !open && 'opacity-0')}>
                  {shown === 'waitlist' ? <WaitlistForm autoFocus={open === 'waitlist'} /> : <MechanicLeadForm autoFocus={open === 'mechanic'} />}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggle('waitlist')}
              aria-expanded={open === 'waitlist'}
              aria-controls="lead-panel"
              className={cx(
                'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-all duration-300 active:scale-[0.97]',
                // Lime marks the main call to action; once open, the submit button takes over.
                open === 'waitlist'
                  ? 'bg-ink text-paper'
                  : open === 'mechanic'
                    ? 'bg-sand text-muted'
                    : done.waitlist
                      ? 'border border-line-strong bg-paper text-ink'
                      : 'bg-lime text-ink hover:bg-lime-deep',
              )}
            >
              {done.waitlist ? (
                <>
                  <Check className="size-4" strokeWidth={3} aria-hidden /> Apuntado
                </>
              ) : (
                <>
                  Avísame
                  <ArrowRight className={cx('size-4 transition-transform duration-300', open === 'waitlist' && '-rotate-90')} aria-hidden />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => toggle('mechanic')}
              aria-expanded={open === 'mechanic'}
              aria-controls="lead-panel"
              className={cx(
                'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border text-[15px] font-semibold transition-all duration-300 active:scale-[0.97]',
                open === 'mechanic' ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-ink hover:border-ink',
              )}
            >
              {done.mechanic ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Wrench className="size-4" aria-hidden />}
              Soy mecánico
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
