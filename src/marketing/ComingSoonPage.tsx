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
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 h-[34dvh] overflow-hidden">
        <div className="cq-glow absolute bottom-[-26dvh] left-1/2 h-[48dvh] w-[150vw] max-w-[1400px] rounded-full bg-[radial-gradient(closest-side,rgb(215_255_0/0.55),rgb(215_255_0/0.2)_55%,rgb(215_255_0/0))] blur-2xl" />
      </div>

      {/* On very short screens the page scrolls, with room to bring the cards clear of the buttons. */}
      <main className="relative flex flex-1 flex-col items-center pb-8 pt-[max(1.5rem,4dvh)] sm:pt-[max(2.5rem,6dvh)] [@media(max-height:620px)]:pb-28">
        <div className="flex flex-col items-center px-6 text-center">
          {/* Quiet status label: no box, just a softly pulsing lime dot. */}
          <p className="cq-rise inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70" style={delay(100)}>
            <span className="relative flex size-2" aria-hidden>
              <span className="cq-ping absolute inset-0 rounded-full bg-lime" />
              <span className="relative size-2 rounded-full bg-lime ring-1 ring-ink/25" />
            </span>
            Próximamente
          </p>
          <h1 className="cq-rise mt-4" style={delay(250)}>
            <Wordmark className="text-[44px] sm:text-6xl" />
          </h1>
          <p className="cq-rise mt-2.5 max-w-[21rem] text-balance text-[15px] leading-normal text-muted sm:max-w-md sm:text-base" style={delay(400)}>
            Encuentra mecánicos de confianza para reparar, mantener o revisar tu bici, donde y cuando te venga mejor.
          </p>
        </div>

        <div className="cq-rise mt-6 w-full sm:mt-10" style={delay(600)}>
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
