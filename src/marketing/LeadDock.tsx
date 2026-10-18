import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, X } from 'lucide-react';
import { cx } from '@/components/ui';
import { MechanicLeadForm, WaitlistForm, type LeadFormState } from './LeadForms';
import type { LeadKind } from './leads';

const FORM_ID: Record<LeadKind, string> = { waitlist: 'lead-waitlist', mechanic: 'lead-mechanic' };
const CLOSE = 56; // px, the round close button
const GAP = 12; // px
const SPRING = 'cubic-bezier(.2,1.2,.3,1)';

/**
 * Two floating calls to action that morph in place: the left one ("Avísame") stretches
 * into "Confirmar" and the right one ("Soy mecánico") shrinks into a round close button,
 * whichever was chosen, while the form card rises above. Closing plays it in reverse.
 */
export function LeadDock() {
  const [open, setOpen] = useState<LeadKind | null>(null);
  // Keep the last form mounted while the card animates out.
  const [shown, setShown] = useState<LeadKind>('waitlist');
  const [openSeq, setOpenSeq] = useState(0);
  const [form, setForm] = useState<LeadFormState>({ sending: false, done: false });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = (kind: LeadKind) => {
    setShown(kind);
    setForm({ sending: false, done: false });
    setOpen(kind);
    setOpenSeq((n) => n + 1);
  };

  // Geometry of the bottom row (left / width of each button), closed vs open.
  const half = `calc(50% - ${GAP / 2}px)`;
  const pos = {
    primary: open ? { left: '0px', width: `calc(100% - ${CLOSE + GAP}px)` } : { left: '0px', width: half },
    secondary: open ? { left: `calc(100% - ${CLOSE}px)`, width: `${CLOSE}px` } : { left: `calc(50% + ${GAP / 2}px)`, width: half },
  };
  const move: CSSProperties = { transition: `left 560ms ${SPRING}, width 560ms ${SPRING}, transform 300ms ease` };
  const buttonClass =
    'absolute top-0 flex h-14 items-center justify-center overflow-hidden rounded-[28px] text-[15px] font-semibold text-ink active:scale-[0.97]';
  // Labels cross-fade with a slight blur so one word melts into the next.
  const label = (visible: boolean) =>
    cx('col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap transition-[opacity,transform,filter] duration-300', visible ? 'scale-100 opacity-100 blur-0' : 'scale-90 opacity-0 blur-[3px]');

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(null)}
        className={cx(
          'fixed inset-0 z-20 bg-paper/25 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(10px,env(safe-area-inset-bottom))]" data-testid="lead-dock">
        {/* One box: when open it frosts in and wraps the form and the buttons with the same side padding. */}
        <div className="relative mx-auto max-w-md p-4">
          <div
            aria-hidden
            className={cx('glass-card pointer-events-none absolute inset-0 rounded-[38px]', open ? 'scale-100 opacity-100' : 'translate-y-4 scale-[0.97] opacity-0')}
            style={{ transition: `transform 520ms ${SPRING}, opacity 260ms ease` }}
          />

          <div
            id="lead-panel"
            role="region"
            aria-label={shown === 'waitlist' ? 'Lista de espera' : 'Registro para mecánicos'}
            className={cx('relative grid', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
            style={{ transition: `grid-template-rows 520ms ${SPRING}, opacity 240ms ease` }}
            {...(!open ? { inert: '' } : {})}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="max-h-[min(60dvh,500px)] overflow-y-auto pb-4 pt-1">
                <div key={`${shown}-${openSeq}`}>
                  {shown === 'waitlist' ? (
                    <WaitlistForm formId={FORM_ID.waitlist} autoFocus={open === 'waitlist'} onState={setForm} />
                  ) : (
                    <MechanicLeadForm formId={FORM_ID.mechanic} autoFocus={open === 'mechanic'} onState={setForm} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: two floating glass buttons that morph in place */}
          <div className="relative h-14">
            <button
              type={open ? 'submit' : 'button'}
              form={open ? FORM_ID[open] : undefined}
              disabled={form.sending}
              onClick={(e) => {
                if (!open) {
                  // The button turns into a submit button as it opens; don't let this click submit.
                  e.preventDefault();
                  return choose('waitlist');
                }
                if (form.done) {
                  e.preventDefault();
                  setOpen(null);
                }
              }}
              aria-expanded={open ? undefined : false}
              aria-controls={open ? undefined : 'lead-panel'}
              className={cx(buttonClass, 'glass-lime')}
              style={{ ...move, ...pos.primary }}
            >
              <span className="grid">
                <span className={label(!open)} aria-hidden={!!open || undefined}>
                  Avísame
                </span>
                <span className={label(!!open)} aria-hidden={!open || undefined}>
                  {form.sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {form.done ? 'Listo' : 'Confirmar'}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => (open ? setOpen(null) : choose('mechanic'))}
              aria-expanded={!!open}
              aria-controls="lead-panel"
              aria-label={open ? 'Cerrar' : undefined}
              className={cx(buttonClass, 'glass')}
              style={{ ...move, ...pos.secondary }}
            >
              <span className={cx('whitespace-nowrap transition-[opacity,transform,filter] duration-300', open ? 'scale-75 opacity-0 blur-[3px]' : 'opacity-100')}>
                Soy mecánico
              </span>
              <X className={cx('absolute size-5 transition-all duration-300', open ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0')} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
