import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildSlides, useSiteContent } from './siteContent';
import { cx } from '@/components/ui';

const INTERVAL_MS = 3600;
const EXIT_MS = 650;

/** Where a card sits in the fanned stack: 0 is the front, higher numbers sit further back. */
function slotTransform(slot: number) {
  if (slot === 0) return 'translate3d(0, 0, 0) rotate(-3deg) scale(1)';
  return `translate3d(${slot * 16}px, ${slot * 7}px, 0) rotate(${slot * 6 - 1}deg) scale(${1 - slot * 0.045})`;
}

/** The front photo following a finger: it slides and tilts a little with the drag. */
function dragTransform(dx: number) {
  return `translate3d(${dx}px, ${Math.abs(dx) * 0.06}px, 0) rotate(${-3 + dx / 18}deg) scale(1)`;
}

/** Words between *asterisks* are highlighted; without any, the last word is. */
export function highlightParts(title: string): { text: string; accent: boolean }[] {
  if (title.includes('*')) {
    return title
      .split('*')
      .map((text, i) => ({ text, accent: i % 2 === 1 }))
      .filter((p) => p.text);
  }
  const cut = title.trimEnd().lastIndexOf(' ');
  return cut < 0 ? [{ text: title, accent: true }] : [{ text: title.slice(0, cut + 1), accent: false }, { text: title.slice(cut + 1), accent: true }];
}

function Highlighted({ title }: { title: string }) {
  return (
    <>
      {highlightParts(title).map((p, i) => (p.accent ? <span key={i} className="text-lime-text">{p.text}</span> : p.text))}
    </>
  );
}

/**
 * The benefits as a fanned deck of photos. Every few seconds the front photo lifts away with a
 * blur and the next one settles in, while the headline in the top-left corner changes with it.
 * Tap or swipe the deck to move on (which stops the autoplay); press and hold to pause. With
 * reduced motion it stays on the first benefit and only moves when asked.
 */
export function BenefitsDeck() {
  const content = useSiteContent();
  const slides = useMemo(() => buildSlides(content), [content]);
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [holding, setHolding] = useState(false);
  const [dragX, setDragX] = useState(0);
  const press = useRef<{ x: number; y: number; t: number; id: number; horizontal: boolean | null } | null>(null);
  const exitFrom = useRef<string | null>(null);

  const goTo = useCallback(
    (next: number, animate = true) => {
      setActive((current) => {
        const target = ((next % count) + count) % count;
        if (target === current) return current;
        if (animate && !reduced.current) setExiting(current);
        return target;
      });
    },
    [count],
  );

  useEffect(() => {
    if (exiting === null) return;
    const t = window.setTimeout(() => {
      setExiting(null);
      exitFrom.current = null;
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [exiting]);

  useEffect(() => {
    if (paused || holding || reduced.current || count < 2) return;
    const t = window.setInterval(() => {
      if (!document.hidden) goTo(active + 1);
    }, INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [active, paused, holding, count, goTo]);

  if (!count) return null;

  return (
    <section aria-roledescription="carrusel" aria-label="Ventajas de Cromiqa" className="flex w-full flex-1 flex-col" data-testid="benefits">
      {/* Headline: every benefit is stacked in one grid cell, so the height never jumps. */}
      <div className="grid text-left">
        {slides.map((slide, i) => (
          <div
            key={i}
            aria-hidden={i !== active || undefined}
            className={cx(
              'col-start-1 row-start-1 transition-[opacity,filter,transform] duration-500 ease-out',
              i === active ? 'translate-y-0 opacity-100 blur-0' : 'pointer-events-none translate-y-1.5 opacity-0 blur-[6px]',
            )}
          >
            <h2 className="text-balance font-sans text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[40px]">
              <Highlighted title={slide.title} />
              <span className="sr-only">. {slide.text}</span>
            </h2>
          </div>
        ))}
      </div>

      {/* The deck takes the free space between the headline and the buttons, centred in it. */}
      <div className="flex flex-1 items-center justify-center py-6">
        <div
          // Sized by width and by the height left on screen, so the buttons never cover it.
          className="relative aspect-[5/6] w-[clamp(160px,min(72vw,300px,(100svh-340px)*0.8),300px)] cursor-pointer select-none [-webkit-touch-callout:none]"
          // Touch: vertical moves still scroll the page; horizontal ones drag the front photo.
          style={{ marginRight: `${(count - 1) * 16}px`, touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            press.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, horizontal: null };
            setHolding(true); // holding pauses the autoplay
          }}
          onPointerMove={(e) => {
            const p = press.current;
            if (!p || p.id !== e.pointerId) return;
            const dx = e.clientX - p.x;
            const dy = e.clientY - p.y;
            if (p.horizontal === null && Math.hypot(dx, dy) > 8) {
              p.horizontal = Math.abs(dx) > Math.abs(dy);
              if (p.horizontal) e.currentTarget.setPointerCapture(e.pointerId);
            }
            if (p.horizontal) setDragX(dx);
          }}
          onPointerUp={(e) => {
            const p = press.current;
            press.current = null;
            setHolding(false);
            if (!p) return;
            const dx = e.clientX - p.x;
            if (p.horizontal && Math.abs(dx) > 60) {
              exitFrom.current = dragTransform(dx);
              setPaused(true);
              goTo(active + (dx < 0 ? 1 : -1));
            } else if (p.horizontal === null && Date.now() - p.t < 400) {
              setPaused(true);
              goTo(active + 1);
            }
            setDragX(0);
          }}
          onPointerCancel={() => {
            press.current = null;
            setHolding(false);
            setDragX(0);
          }}
        >
          {slides.map((slide, i) => {
            const slot = (i - active + count) % count;
            const leaving = i === exiting;
            const style = {
              zIndex: leaving ? count + 1 : count - slot,
              transform: slot === 0 && dragX ? dragTransform(dragX) : slotTransform(slot),
              '--cq-from': (leaving && exitFrom.current) || slotTransform(0),
              '--cq-to': slotTransform(slot),
            } as CSSProperties;
            return (
              <div
                key={i}
                aria-hidden={i !== active || undefined}
                className={cx(
                  'absolute inset-0 overflow-hidden rounded-[22px] bg-sand shadow-[0_18px_40px_-18px_rgb(23_23_23/0.45)] ring-1 ring-ink/5',
                  leaving ? 'cq-deck-exit' : slot === 0 && dragX ? '' : 'transition-transform duration-700 ease-[cubic-bezier(.2,.9,.25,1)]',
                )}
                style={style}
              >
                {slide.photo && (
                  <img
                    src={slide.photo.src}
                    alt={slide.photo.alt}
                    loading={slot < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    className="size-full object-cover"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}
