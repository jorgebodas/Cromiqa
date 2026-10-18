import type { CSSProperties } from 'react';
import { Wordmark } from '@/brand/Wordmark';
import { BenefitsCarousel } from './BenefitsCarousel';
import { LeadDock } from './LeadDock';
import { leadsEnabled } from './leads';

/** Animated app icon: the ring draws itself, then the lime check lands. */
function HeroMark() {
  return (
    <span className="cq-pop relative flex size-24 items-center justify-center rounded-[28px] bg-ink shadow-[0_20px_50px_-20px_rgb(23_23_23/0.55)]" aria-hidden>
      <svg viewBox="0 0 124 100" className="w-[62px] overflow-visible">
        <ellipse cx="52" cy="50" rx="44" ry="41.5" fill="none" stroke="#fff" strokeWidth="17" pathLength={1} className="cq-draw" style={{ animationDelay: '250ms' }} />
        <path d="M63 75 L77 89 L114 52" fill="none" stroke="#171717" strokeWidth="29" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M63 75 L77 89 L114 52" fill="none" stroke="#C7FF2F" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="cq-draw" style={{ animationDelay: '900ms' }} />
      </svg>
    </span>
  );
}

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/** Public face of cromiqa.com while the product is private. */
export function ComingSoonPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      {/* Soft light glow, the light-mode echo of a spotlight. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70dvh] bg-[radial-gradient(60%_55%_at_50%_30%,#F6F4EF_0%,#FFFFFF_70%)]" />

      <main className="relative flex flex-1 flex-col items-center justify-center pb-32 pt-14 sm:pt-20">
        <div className="flex flex-col items-center px-6 text-center">
          <HeroMark />
          <p className="cq-rise mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium" style={delay(500)}>
            <span className="size-1.5 rounded-full bg-lime ring-2 ring-ink/80" aria-hidden />
            Próximamente · Madrid sureste
          </p>
          <h1 className="cq-rise mt-5" style={delay(650)}>
            <Wordmark className="text-[44px] sm:text-6xl" />
          </h1>
          <p className="cq-rise mt-3 text-base text-muted sm:text-lg" style={delay(800)}>
            Tu bici, en buenas manos.
          </p>
        </div>

        <div className="cq-rise mt-10 w-full sm:mt-14" style={delay(1000)}>
          <BenefitsCarousel />
        </div>
      </main>

      <footer className="relative pb-28 text-center text-xs text-subtle">© {new Date().getFullYear()} Cromiqa</footer>

      {leadsEnabled && <LeadDock />}
    </div>
  );
}
