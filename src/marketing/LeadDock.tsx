import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, X } from 'lucide-react';
import { cx } from '@/components/ui';
import { MechanicLeadForm, WaitlistForm, type LeadFormState } from './LeadForms';
import { alreadySubmitted, type LeadKind } from './leads';

const FORM_ID: Record<LeadKind, string> = { waitlist: 'lead-waitlist', mechanic: 'lead-mechanic' };
const CLOSE = 56; // px, the round close button
const GAP = 12; // px
const SPRING = 'cubic-bezier(.2,1.2,.3,1)';

/**
 * Two floating calls to action. Choosing one slides the other away, turns the chosen one
 * into a round close button, and grows a "Confirmar" button into the freed space while
 * the form card rises above. Mirrored for the right-hand button.
 */
export function LeadDock() {
  const [open, setOpen] = useState<LeadKind | null>(null);
  // Keep the last form mounted while the card animates out.
  const [shown, setShown] = useState<LeadKind>('waitlist');
  const [openSeq, setOpenSeq] = useState(0);
  const [form, setForm] = useState<LeadFormState>({ sending: false, done: false });
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

  const choose = (kind: LeadKind) => {
    if (open) return setOpen(null);
    setShown(kind);
    setForm({ sending: false, done: alreadySubmitted(kind) });
    setOpen(kind);
    setOpenSeq((n) => n + 1);
  };

  // Geometry of the bottom row for each state (left / width of each control).
  const half = `calc(50% - ${GAP / 2}px)`;
  const rest = `calc(100% - ${CLOSE + GAP}px)`;
  const pos = {
    waitlist:
      open === 'waitlist' ? { left: '0px', width: `${CLOSE}px` } : open === 'mechanic' ? { left: '-60%', width: half } : { left: '0px', width: half },
    mechanic:
      open === 'mechanic'
        ? { left: `calc(100% - ${CLOSE}px)`, width: `${CLOSE}px` }
        : open === 'waitlist'
          ? { left: '110%', width: half }
          : { left: `calc(50% + ${GAP / 2}px)`, width: half },
    confirm:
      open === 'waitlist'
        ? { left: `${CLOSE + GAP}px`, width: rest }
        : open === 'mechanic'
          ? { left: '0px', width: rest }
          : { left: '50%', width: '0px' },
  };
  const move: CSSProperties = { transition: `left 520ms ${SPRING}, width 520ms ${SPRING}, opacity 260ms ease, transform 300ms ease, background-color 250ms ease, color 250ms ease` };

  const toggleClass =
    'absolute top-0 flex h-14 items-center justify-center overflow-hidden rounded-[28px] text-[15px] font-semibold text-ink active:scale-[0.97]';

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(null)}
        className={cx(
          'fixed inset-0 z-20 bg-paper/40 backdrop-blur-[4px] transition-opacity duration-300',
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

          {/* Bottom row: two floating glass buttons that morph */}
          <div className="relative h-14">
            <button
              type="button"
              onClick={() => choose('waitlist')}
              aria-expanded={open === 'waitlist'}
              aria-controls="lead-panel"
              aria-label={open === 'waitlist' ? 'Cerrar' : undefined}
              tabIndex={open === 'mechanic' ? -1 : 0}
              aria-hidden={open === 'mechanic' || undefined}
              className={cx(
                toggleClass,
                open === 'waitlist' || done.waitlist ? 'glass' : 'glass-lime',
                open === 'mechanic' && 'pointer-events-none opacity-0',
              )}
              style={{ ...move, ...pos.waitlist }}
            >
              <span className={cx('whitespace-nowrap transition-all duration-200', open === 'waitlist' ? 'scale-75 opacity-0' : 'opacity-100')}>
                {done.waitlist ? 'Apuntado' : 'Avísame'}
              </span>
              <X className={cx('absolute size-5 transition-all duration-300', open === 'waitlist' ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0')} aria-hidden />
            </button>

            <button
              type="submit"
              form={open ? FORM_ID[open] : undefined}
              disabled={!open || form.sending}
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                if (form.done) {
                  e.preventDefault();
                  setOpen(null);
                }
              }}
              className={cx(
                'glass-lime absolute top-0 flex h-14 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-[28px] text-[15px] font-semibold text-ink active:scale-[0.98]',
                open ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              style={{ ...move, ...pos.confirm }}
              aria-hidden={!open || undefined}
            >
              {form.sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {form.done ? 'Listo' : 'Confirmar'}
            </button>

            <button
              type="button"
              onClick={() => choose('mechanic')}
              aria-expanded={open === 'mechanic'}
              aria-controls="lead-panel"
              aria-label={open === 'mechanic' ? 'Cerrar' : undefined}
              tabIndex={open === 'waitlist' ? -1 : 0}
              aria-hidden={open === 'waitlist' || undefined}
              className={cx(toggleClass, 'glass', open === 'waitlist' && 'pointer-events-none opacity-0')}
              style={{ ...move, ...pos.mechanic }}
            >
              <span className={cx('whitespace-nowrap transition-all duration-200', open === 'mechanic' ? 'scale-75 opacity-0' : 'opacity-100')}>
                {done.mechanic ? 'Registrado' : 'Soy mecánico'}
              </span>
              <X className={cx('absolute size-5 transition-all duration-300', open === 'mechanic' ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0')} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
