import { useEffect, type CSSProperties } from 'react';
import { Wordmark } from '@/brand/Wordmark';
import { BenefitsDeck } from './BenefitsDeck';
import { LeadDock } from './LeadDock';
import { leadsEnabled } from './leads';

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Public face of cromiqa.com while the product is private. */
export function ComingSoonPage() {
  // One screen, never scrollable: everything fits the viewport, so swiping the deck can't
  // fight with the page scroll.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-paper">

      <main className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+92px)] pt-[max(1.25rem,3dvh)] sm:pb-40 sm:max-w-xl sm:pt-[max(2rem,5dvh)]">
        {/* Brand row: wordmark and the status label. */}
        <div className="cq-rise flex items-center justify-between" style={delay(100)}>
          <h1>
            <Wordmark className="text-[26px] sm:text-[30px]" />
          </h1>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em]">
            <span className="cq-glint">Próximamente</span>
          </p>
        </div>

        <div className="cq-rise mt-6 flex min-h-0 flex-1 flex-col sm:mt-10" style={delay(250)}>
          <BenefitsDeck />
        </div>
        {/* What Cromiqa is, for screen readers and search engines; the headline carries it visually. */}
        <p className="sr-only">Encuentra mecánicos de confianza para reparar, mantener o revisar tu bici, donde y cuando te venga mejor.</p>
      </main>

      {/* On phones the floating buttons sit where the footer would be. */}
      <footer className="absolute inset-x-0 bottom-28 hidden text-center text-xs text-subtle sm:block">
        © {new Date().getFullYear()} Cromiqa
        {import.meta.env.VITE_STAGING && <span> · Staging: los envíos se simulan</span>}
      </footer>

      {leadsEnabled && <LeadDock />}
    </div>
  );
}
