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
    <section aria-label="Ventajas de Cromiqa" className="mx-auto w-full max-w-3xl">
      <div
        ref={track}
        className="no-scrollbar overflow-x-auto py-3 [mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)]"
        data-testid="benefits"
      >
        <div className="flex w-max gap-3 px-3">
          {[0, 1].map((copy) => (
            <ul key={copy} data-copy={copy} aria-hidden={copy === 1 || undefined} className="flex gap-3">
              {SLIDES.map((slide, i) =>
                slide.kind === 'text' ? (
                  <li key={`t-${i}`} className="h-[176px] w-[250px] shrink-0 rounded-3xl border border-line bg-paper px-5 py-5 sm:w-[270px]">
                    <h3 className="font-display text-[17px] font-extrabold leading-tight">{slide.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{slide.text}</p>
                  </li>
                ) : (
                  <li key={`p-${i}`} className="relative h-[176px] w-[200px] shrink-0 overflow-hidden rounded-3xl bg-sand sm:w-[220px]">
                    <img src={slide.src} alt={copy === 1 ? '' : slide.alt} loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                    <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-ink/5" aria-hidden />
                  </li>
                ),
              )}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
