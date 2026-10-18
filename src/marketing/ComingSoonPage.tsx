import type { CSSProperties } from 'react';
import { Wordmark } from '@/brand/Wordmark';
import { BenefitsCarousel } from './BenefitsCarousel';
import { LeadDock } from './LeadDock';
import { leadsEnabled } from './leads';

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Public face of cromiqa.com while the product is private. */
export function ComingSoonPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      {/* One lime glow low on the page, behind the buttons, drifting slowly; the rest stays clean. */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 h-[55dvh] overflow-hidden">
        <div className="cq-glow absolute bottom-[-30dvh] left-1/2 h-[70dvh] w-[150vw] max-w-[1400px] rounded-full bg-[radial-gradient(closest-side,rgb(215_255_0/0.5),rgb(215_255_0/0.18)_55%,rgb(215_255_0/0))] blur-2xl" />
      </div>

      <main className="relative flex flex-1 flex-col items-center pb-8 pt-[max(2.5rem,7dvh)] sm:pt-[max(4rem,9dvh)]">
        <div className="flex flex-col items-center px-6 text-center">
          <p className="cq-rise inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium" style={delay(100)}>
            <span className="size-1.5 rounded-full bg-lime ring-2 ring-ink/80" aria-hidden />
            Próximamente
          </p>
          <h1 className="cq-rise mt-5" style={delay(250)}>
            <Wordmark className="text-[44px] sm:text-6xl" />
          </h1>
          <p className="cq-rise mt-3 text-base text-muted sm:text-lg" style={delay(400)}>
            Tu bici, en buenas manos.
          </p>
        </div>

        <div className="cq-rise mt-8 w-full sm:mt-12" style={delay(600)}>
          <BenefitsCarousel />
        </div>
      </main>

      {/* On phones the floating buttons sit where the footer would be. */}
      <footer className="relative hidden pb-32 text-center text-xs text-subtle sm:block">
        © {new Date().getFullYear()} Cromiqa
        {import.meta.env.VITE_STAGING && <span> · Staging: los envíos se simulan</span>}
      </footer>

      {leadsEnabled && <LeadDock />}
    </div>
  );
}
