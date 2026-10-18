import { useEffect, useMemo, useRef } from 'react';
import { buildSlides, useSiteContent } from './siteContent';

const SPEED_PX_PER_S = 28;
const RESUME_AFTER_MS = 2500;

/**
 * Continuous, smooth marquee of benefits. Still swipeable: touching pauses it and it
 * resumes shortly after. Items are rendered twice to loop seamlessly; the copy is
 * hidden from assistive tech. Static when the visitor prefers reduced motion.
 */
export function BenefitsCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const content = useSiteContent();
  const SLIDES = useMemo(() => buildSlides(content), [content]);

  useEffect(() => {
    const el = track.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    let pos = el.scrollLeft;
    let pausedUntil = 0;
    let hovering = false;

    const loopWidth = () => {
      const second = el.querySelector<HTMLElement>('[data-copy="1"]');
      const first = el.querySelector<HTMLElement>('[data-copy="0"]');
      return second && first ? second.offsetLeft - first.offsetLeft : 0;
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      if (!hovering && now > pausedUntil) {
        const w = loopWidth();
        pos += SPEED_PX_PER_S * dt;
        if (w && pos >= w) pos -= w;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft; // follow manual swipes
        const w = loopWidth();
        if (w && pos >= w) el.scrollLeft = pos -= w;
      }
      raf = requestAnimationFrame(tick);
    };

    const pause = () => (pausedUntil = performance.now() + 60_000);
    const resumeSoon = () => (pausedUntil = performance.now() + RESUME_AFTER_MS);
    const enter = () => (hovering = true);
    const leave = () => (hovering = false);
    el.addEventListener('pointerdown', pause);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('pointerup', resumeSoon);
    el.addEventListener('touchend', resumeSoon);
    el.addEventListener('wheel', resumeSoon, { passive: true });
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('pointerup', resumeSoon);
      el.removeEventListener('touchend', resumeSoon);
      el.removeEventListener('wheel', resumeSoon);
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    };
  }, []);

  return (
    <section aria-label="Ventajas de Cromiqa" className="mx-auto w-full max-w-4xl">
      <div
        ref={track}
        className="no-scrollbar overflow-x-auto py-3 [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]"
        data-testid="benefits"
      >
        <div className="flex w-max gap-3 px-3">
          {[0, 1].map((copy) => (
            <ul key={copy} data-copy={copy} aria-hidden={copy === 1 || undefined} className="flex gap-3">
              {SLIDES.map((slide, i) => (
                <li key={i} className="relative aspect-[5/6] w-[244px] shrink-0 overflow-hidden rounded-3xl bg-ink sm:w-[268px]">
                  {slide.photo && (
                    <img
                      src={slide.photo.src}
                      alt={copy === 1 ? '' : slide.photo.alt}
                      loading={i < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  {/* Frosted glass band: the photo itself, blurred, under the text. */}
                  <div className="absolute inset-x-0 bottom-0 border-t border-white/15 bg-[rgb(22_22_22/0.55)] px-4 pb-3.5 pt-3 text-left text-white backdrop-blur-xl backdrop-saturate-150">
                    <h3 className="font-sans text-[15px] font-bold leading-tight tracking-normal">{slide.title}</h3>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-white">{slide.text}</p>
                  </div>
                  <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" aria-hidden />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
