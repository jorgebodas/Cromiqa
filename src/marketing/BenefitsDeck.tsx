import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { buildSlides, useSiteContent } from './siteContent';
import { cx } from '@/components/ui';

const INTERVAL_MS = 3800;
const FLY_MS = 300;
const RETURN_MS = 380;

interface Pose {
  x: number;
  y: number;
  r: number;
  s: number;
}

/** Where a card sits in the fanned stack: 0 is the front, higher numbers sit further back. */
function slotPose(slot: number): Pose {
  return slot === 0 ? { x: 0, y: 0, r: -3, s: 1 } : { x: slot * 14, y: slot * 7, r: slot * 6 - 1, s: 1 - slot * 0.045 };
}
const lerp = (a: Pose, b: Pose, t: number): Pose => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: a.r + (b.r - a.r) * t, s: a.s + (b.s - a.s) * t });
const css = (p: Pose) => `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.r}deg) scale(${p.s})`;
/** The front photo under a finger: it moves freely on the plane and tilts with the sideways part. */
const dragPose = (dx: number, dy: number): Pose => ({ x: dx, y: dy, r: -3 + dx / 14, s: 1.02 });

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

interface Press {
  id: number;
  x: number;
  y: number;
  t: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
}

/**
 * A card leaving the front: first it flies off above the others ('fly'), then it fades in at
 * the back of the fan underneath them ('back'), so it never shows on top of the new front.
 */
interface Exit {
  index: number;
  from: string;
  fly: string;
  phase: 'fly' | 'back';
}

/**
 * The benefits as a fanned deck of photos, with the benefit as a big sentence above it.
 * Every few seconds the front photo lifts away with a blur and the next settles in. The
 * front photo also follows a finger anywhere on the plane: throw it in any direction (a short
 * flick is enough) and the next one comes up; let go early and it springs back. The cards
 * behind tighten up as you drag. A tap moves on, pressing and holding pauses, and a one-off
 * nudge shows that the photo can be moved. With reduced motion nothing moves on its own.
 */
export function BenefitsDeck() {
  const content = useSiteContent();
  const slides = useMemo(() => buildSlides(content), [content]);
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [exit, setExit] = useState<Exit | null>(null);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState(false);
  const press = useRef<Press | null>(null);
  const deck = useRef<HTMLDivElement>(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const activeRef = useRef(active);
  activeRef.current = active;
  const step = useCallback(
    (fly?: { from: string; fly: string }) => {
      const current = activeRef.current;
      if (!reduced.current) {
        const from = fly?.from ?? css(slotPose(0));
        setExit({ index: current, from, fly: fly?.fly ?? `${from} translate3d(-18px, -26px, 0) scale(1.08)`, phase: 'fly' });
      }
      setActive((current + 1) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!exit) return;
    const t = window.setTimeout(
      () => setExit((e) => (e && e.index === exit.index ? (e.phase === 'fly' ? { ...e, phase: 'back' } : null) : e)),
      exit.phase === 'fly' ? FLY_MS : RETURN_MS,
    );
    return () => window.clearTimeout(t);
  }, [exit]);

  useEffect(() => {
    if (paused || holding || reduced.current || count < 2) return;
    const t = window.setInterval(() => !document.hidden && step(), INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [active, paused, holding, count, step]);

  // A single nudge shortly after load, so it's clear the photo can be moved.
  useEffect(() => {
    if (reduced.current) return;
    const on = window.setTimeout(() => setHint(true), 1500);
    const off = window.setTimeout(() => setHint(false), 2700);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, []);

  if (!count) return null;

  const width = () => deck.current?.offsetWidth ?? 240;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (press.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now, lastX: e.clientX, lastY: e.clientY, lastT: now, vx: 0, vy: 0 };
    setHolding(true);
    setHint(false);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const now = performance.now();
    if (now > p.lastT) {
      p.vx = (e.clientX - p.lastX) / (now - p.lastT);
      p.vy = (e.clientY - p.lastY) / (now - p.lastT);
    }
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    p.lastT = now;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) > 3) setDrag({ x: dx, y: dy });
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    setHolding(false);
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const dist = Math.hypot(dx, dy);
    // A flick counts if the finger was still moving fast when it let go.
    const stillMoving = performance.now() - p.lastT < 120;
    const speed = Math.hypot(p.vx, p.vy);
    const fling = stillMoving && speed > 0.25 && dist > 12;
    if (dist > width() * 0.28 || fling) {
      // Thrown: keep going the way it was thrown (the flick's direction, or the drag's).
      const [ux, uy] = fling ? [p.vx / speed, p.vy / speed] : [dx / dist, dy / dist];
      const reach = width() * 1.3;
      const out = { x: dx + ux * reach, y: dy + uy * reach };
      setPaused(true);
      navigator.vibrate?.(8);
      step({ from: css(dragPose(dx, dy)), fly: css({ ...dragPose(out.x, out.y), r: -3 + out.x / 10 }) });
    } else if (dist < 6 && performance.now() - p.t < 350) {
      setPaused(true);
      step();
    }
    setDrag(null);
  };
  const onCancel = () => {
    press.current = null;
    setHolding(false);
    setDrag(null);
  };

  // How far the drag has gone (0–1): the cards behind move up towards the front as it grows.
  const progress = drag === null ? 0 : Math.min(Math.hypot(drag.x, drag.y) / (width() * 0.5), 1);

  return (
    <section aria-roledescription="carrusel" aria-label="Ventajas de Cromiqa" className="flex min-h-0 w-full flex-1 flex-col" data-testid="benefits">
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
            <h2 className="max-w-[11ch] text-balance font-sans text-[34px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[42px]">
              <Highlighted title={slide.title} />
              <span className="sr-only">. {slide.text}</span>
            </h2>
          </div>
        ))}
      </div>

      {/* The deck fills the space left between the headline and the buttons, centred in it. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-5 [container-type:size]">
        <div
          ref={deck}
          // Width from the screen and from the height available here, whichever is smaller.
          className={cx(
            'relative aspect-[5/6] w-[min(62vw,250px,calc(80cqh*0.8))] select-none [-webkit-touch-callout:none] [touch-action:none]',
            drag === null ? 'cursor-grab' : 'cursor-grabbing',
          )}
          style={{ marginRight: `${(count - 1) * 14}px` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          onLostPointerCapture={onCancel}
        >
          {slides.map((slide, i) => {
            const slot = (i - active + count) % count;
            const flying = exit?.index === i && exit.phase === 'fly';
            const returning = exit?.index === i && exit.phase === 'back';
            const dragging = drag !== null;
            const pose = slot === 0 && drag ? dragPose(drag.x, drag.y) : dragging && slot > 0 ? lerp(slotPose(slot), slotPose(slot - 1), progress * 0.6) : slotPose(slot);
            const style = {
              zIndex: flying ? count + 1 : count - slot,
              transform: flying ? undefined : css(pose),
              '--cq-from': flying ? exit.from : undefined,
              '--cq-fly': flying ? exit.fly : undefined,
            } as CSSProperties;
            return (
              <div
                key={i}
                aria-hidden={i !== active || undefined}
                className={cx(
                  'absolute inset-0',
                  flying
                    ? 'cq-deck-fly'
                    : returning
                      ? 'cq-deck-return'
                      : slot === 0 && dragging
                      ? ''
                      : dragging
                        ? 'transition-transform duration-150 ease-out'
                        : 'transition-transform duration-[650ms] ease-[cubic-bezier(.2,1.25,.35,1)]',
                )}
                style={style}
              >
                <div
                  className={cx(
                    'size-full overflow-hidden rounded-[22px] bg-sand shadow-[0_18px_40px_-18px_rgb(23_23_23/0.45)] ring-1 ring-ink/5 transition-shadow duration-300',
                    slot === 0 && dragging && 'shadow-[0_28px_50px_-20px_rgb(23_23_23/0.5)]',
                    slot === 0 && hint && 'cq-deck-hint',
                  )}
                >
                  {slide.photo && (
                    <img
                      src={slide.photo.src}
                      alt={slide.photo.alt}
                      loading={slot < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      className="pointer-events-none size-full object-cover"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
