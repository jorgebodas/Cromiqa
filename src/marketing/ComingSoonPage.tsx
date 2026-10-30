import type { CSSProperties } from 'react';
import { Wordmark } from '@/brand/Wordmark';
import { BenefitsDeck } from './BenefitsDeck';
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

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-36 pt-[max(1.25rem,3dvh)] sm:max-w-xl sm:pt-[max(2rem,5dvh)]">
        {/* Brand row: wordmark and the status label. */}
        <div className="cq-rise flex items-center justify-between" style={delay(100)}>
          <h1>
            <Wordmark className="text-[26px] sm:text-[30px]" />
          </h1>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em]">
            <span className="cq-glint">Próximamente</span>
          </p>
        </div>

        <div className="cq-rise mt-6 sm:mt-12" style={delay(250)}>
          <BenefitsDeck />
        </div>

        <p className="cq-rise mx-auto mt-3 max-w-[21rem] text-balance text-center text-[14px] leading-normal text-muted sm:max-w-md sm:text-[15px]" style={delay(450)}>
          Encuentra mecánicos de confianza para reparar, mantener o revisar tu bici, donde y cuando te venga mejor.
        </p>
      </main>

      {/* On phones the floating buttons sit where the footer would be. */}
      <footer className="relative -mt-28 hidden pb-32 text-center text-xs text-subtle sm:block">
        © {new Date().getFullYear()} Cromiqa
        {import.meta.env.VITE_STAGING && <span> · Staging: los envíos se simulan</span>}
      </footer>

      {leadsEnabled && <LeadDock />}
    </div>
  );
}
