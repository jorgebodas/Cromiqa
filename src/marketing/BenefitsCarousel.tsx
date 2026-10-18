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
    <section aria-label="Ventajas de Cromiqa" className="mx-auto w-full max-w-5xl">
      <div
        ref={track}
        className="no-scrollbar overflow-x-auto py-3 [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]"
        data-testid="benefits"
      >
        <div className="flex w-max gap-3 px-3">
          {[0, 1].map((copy) => (
            <ul key={copy} data-copy={copy} aria-hidden={copy === 1 || undefined} className="flex gap-3">
              {SLIDES.map((slide, i) => (
                <li
                  key={i}
                  // Tall portrait cards: they fill the screen down to just above the floating buttons.
                  className="relative aspect-[18/25] h-[clamp(220px,calc(100svh-340px),600px)] sm:h-[clamp(300px,calc(100svh-400px),600px)] shrink-0 overflow-hidden rounded-[28px] bg-ink"
                >
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
                  {/* Darken the lower part so the text always reads, whatever the photo. */}
                  <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(14_14_14/0.88)_0%,rgb(14_14_14/0.55)_32%,rgb(14_14_14/0)_62%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-left text-white">
                    <h3 className="font-display text-[21px] font-extrabold leading-tight">{slide.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-snug text-white/85">{slide.text}</p>
                  </div>
                  <span className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" aria-hidden />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
