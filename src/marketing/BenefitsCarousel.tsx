import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Bike, Home, ReceiptText, ScanSearch, Search } from 'lucide-react';
import { cx } from '@/components/ui';

const BENEFITS = [
  { icon: Search, title: 'Empieza por el problema', text: 'Cuéntanos qué le pasa a tu bici y te mostramos quién puede arreglarlo.' },
  { icon: ReceiptText, title: 'Precios claros', text: 'Precios orientativos antes de pedir nada. Sin sorpresas.' },
  { icon: Home, title: 'A domicilio o en taller', text: 'Tú eliges dónde y cuándo. El mecánico se adapta a ti.' },
  { icon: BadgeCheck, title: 'Mecánicos de confianza', text: 'Profesionales independientes cerca de ti, valorados por otros ciclistas.' },
  { icon: ScanSearch, title: 'Revisión antes de comprar', text: '¿Bici de segunda mano? Que la revise un experto antes de pagar.' },
  { icon: Bike, title: 'Tu garaje digital', text: 'El historial de mantenimiento de tu bici, siempre a mano.' },
];

const AUTOPLAY_MS = 3800;

/** Swipeable, auto-advancing benefits with peeking neighbours. */
export function BenefitsCarousel() {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = (i: number, smooth = true) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    if (!el || !track.current) return;
    const left = el.offsetLeft - (track.current.clientWidth - el.clientWidth) / 2;
    track.current.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  };

  // On wide screens start on the 2nd card so neighbours peek on both sides.
  useEffect(() => {
    if ((track.current?.clientWidth ?? 0) >= 640) goTo(1, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the card closest to the centre.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const centre = t.scrollLeft + t.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        [...t.children].forEach((c, i) => {
          const el = c as HTMLElement;
          const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - centre);
          if (d < bestDist) [best, bestDist] = [i, d];
        });
        setActive(best);
      });
    };
    t.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      t.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Autoplay, unless the visitor interacts or prefers reduced motion.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => goTo((active + 1) % BENEFITS.length), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [active, paused]);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Ventajas de Cromiqa"
      className="w-full"
      onPointerDown={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ul
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-min(39vw,150px))] py-2"
        data-testid="benefits"
      >
        {BENEFITS.map((b, i) => (
          <li
            key={b.title}
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${BENEFITS.length}`}
            className={cx(
              'w-[min(78vw,300px)] shrink-0 snap-center rounded-3xl border bg-paper p-5 transition-all duration-500 ease-out',
              i === active ? 'scale-100 border-line-strong opacity-100 shadow-card' : 'scale-[0.94] border-line opacity-45',
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-sand" aria-hidden>
              <b.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-lg font-extrabold leading-tight">{b.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{b.text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-center gap-1.5">
        {BENEFITS.map((b, i) => (
          <button
            key={b.title}
            type="button"
            aria-label={`Ver ventaja ${i + 1}: ${b.title}`}
            aria-current={i === active || undefined}
            onClick={() => {
              setPaused(true);
              goTo(i);
            }}
            className="flex h-6 items-center"
          >
            <span className={cx('block h-1.5 rounded-full transition-all duration-300', i === active ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong')} />
          </button>
        ))}
      </div>
    </section>
  );
}
