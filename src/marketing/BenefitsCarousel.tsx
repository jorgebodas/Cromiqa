import { useEffect, useRef } from 'react';

const BENEFITS = [
  { title: 'Empieza por el problema', text: 'Cuéntanos qué le pasa a tu bici y te mostramos quién puede arreglarlo.' },
  { title: 'Precios claros', text: 'Precios orientativos antes de pedir nada. Sin sorpresas.' },
  { title: 'A domicilio o en taller', text: 'Tú eliges dónde y cuándo. El mecánico se adapta a ti.' },
  { title: 'Mecánicos de confianza', text: 'Profesionales independientes cerca de ti, valorados por otros ciclistas.' },
  { title: 'Revisión antes de comprar', text: '¿Bici de segunda mano? Que la revise un experto antes de pagar.' },
  { title: 'Tu garaje digital', text: 'El historial de mantenimiento de tu bici, siempre a mano.' },
];

// Photos dropped into src/assets/mechanics/ are interleaved with the texts automatically.
// The file name becomes the alt text: "mecanico-ajustando-frenos.jpg" → "Mecánico ajustando frenos".
const PHOTO_FILES = import.meta.glob<string>('../assets/mechanics/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
});
const PHOTOS = Object.entries(PHOTO_FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => {
    const words = path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim();
    return { src, alt: words ? words[0]!.toUpperCase() + words.slice(1).replace(/mecanico/g, 'mecánico') : 'Mecánico de bicicletas trabajando' };
  });

type Slide = { kind: 'text'; title: string; text: string } | { kind: 'photo'; src: string; alt: string };

/** Text, photo, text, photo… (photos cycle if there are fewer than texts). */
const SLIDES: Slide[] = BENEFITS.flatMap((b, i): Slide[] => {
  const text: Slide = { kind: 'text', ...b };
  const photo = PHOTOS.length ? PHOTOS[i % PHOTOS.length] : undefined;
  return photo ? [text, { kind: 'photo', ...photo }] : [text];
});

const SPEED_PX_PER_S = 28;
const RESUME_AFTER_MS = 2500;

/**
 * Continuous, smooth marquee of benefits. Still swipeable: touching pauses it and it
 * resumes shortly after. Items are rendered twice to loop seamlessly; the copy is
 * hidden from assistive tech. Static when the visitor prefers reduced motion.
 */
export function BenefitsCarousel() {
  const track = useRef<HTMLDivElement>(null);

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
