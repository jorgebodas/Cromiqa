import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { buildSlides, useSiteContent } from './siteContent';
import { cx } from '@/components/ui';

const INTERVAL_MS = 3800;
const EXIT_MS = 620;

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
/** The front photo under a finger: it slides, lifts a touch and tilts with the drag. */
const dragPose = (dx: number): Pose => ({ x: dx, y: -Math.min(Math.abs(dx) * 0.04, 10), r: -3 + dx / 14, s: 1.02 });

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
  t: number;
  lastX: number;
  lastT: number;
  velocity: number;
}

/**
 * The benefits as a fanned deck of photos, with the benefit as a big sentence above it.
 * Every few seconds the front photo lifts away with a blur and the next settles in. The
 * front photo also follows a finger: throw it left for the next one, right for the previous
 * one (a short flick is enough), let go early and it springs back; the cards behind tighten
 * up as you drag. A tap moves on, pressing and holding pauses, and a one-off nudge shows that
 * the photo can be moved. With reduced motion nothing moves on its own.
 */
export function BenefitsDeck() {
  const content = useSiteContent();
  const slides = useMemo(() => buildSlides(content), [content]);
  const count = slides.length;
  const [active, setActive] = useState(0);
  const [exit, setExit] = useState<{ index: number; from: string; fly: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const press = useRef<Press | null>(null);
  const deck = useRef<HTMLDivElement>(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const step = useCallback(
    (dir: 1 | -1, fly?: { from: string; fly: string }) => {
      setActive((current) => {
        if (!reduced.current) {
          const from = fly?.from ?? css(slotPose(0));
          setExit({ index: current, from, fly: fly?.fly ?? `${from} translate3d(-18px, -26px, 0) scale(1.08)` });
        }
        return (current + dir + count) % count;
      });
    },
    [count],
  );

  useEffect(() => {
    if (!exit) return;
    const t = window.setTimeout(() => setExit(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [exit]);

  useEffect(() => {
    if (paused || holding || reduced.current || count < 2) return;
    const t = window.setInterval(() => !document.hidden && step(1), INTERVAL_MS);
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
    press.current = { id: e.pointerId, x: e.clientX, t: now, lastX: e.clientX, lastT: now, velocity: 0 };
    setHolding(true);
    setHint(false);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const now = performance.now();
    if (now > p.lastT) p.velocity = (e.clientX - p.lastX) / (now - p.lastT);
    p.lastX = e.clientX;
    p.lastT = now;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 3) setDragX(dx);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    setHolding(false);
    const dx = e.clientX - p.x;
    // A flick counts if the finger was still moving fast when it let go.
    const stillMoving = performance.now() - p.lastT < 120;
    const fling = stillMoving && Math.abs(p.velocity) > 0.25 && Math.abs(dx) > 12;
    if (Math.abs(dx) > width() * 0.28 || fling) {
      const dir = dx < 0 ? 1 : -1;
      const out = dx + Math.sign(dx) * width() * 1.1;
      setPaused(true);
      navigator.vibrate?.(8);
      step(dir, { from: css(dragPose(dx)), fly: css({ ...dragPose(out), r: -3 + out / 10 }) });
    } else if (Math.abs(dx) < 6 && performance.now() - p.t < 350) {
      setPaused(true);
      step(1);
    }
    setDragX(null);
  };
  const onCancel = () => {
    press.current = null;
    setHolding(false);
    setDragX(null);
  };

  // How far the drag has gone (0–1): the cards behind move up towards the front as it grows.
  const progress = dragX === null ? 0 : Math.min(Math.abs(dragX) / (width() * 0.5), 1);

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
            dragX === null ? 'cursor-grab' : 'cursor-grabbing',
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
            const leaving = exit?.index === i;
            const dragging = dragX !== null;
            const pose = slot === 0 && dragging ? dragPose(dragX) : dragging && slot > 0 ? lerp(slotPose(slot), slotPose(slot - 1), progress * 0.6) : slotPose(slot);
            const style = {
              zIndex: leaving ? count + 1 : count - slot,
              transform: css(pose),
              '--cq-from': leaving ? exit.from : undefined,
              '--cq-fly': leaving ? exit.fly : undefined,
              '--cq-to': css(slotPose(slot)),
            } as CSSProperties;
            return (
              <div
                key={i}
                aria-hidden={i !== active || undefined}
                className={cx(
                  'absolute inset-0',
                  leaving
                    ? 'cq-deck-exit'
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
