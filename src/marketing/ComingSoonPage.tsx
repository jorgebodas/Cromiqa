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
      {/* Soft light glow plus two faint lime/yellow lights drifting behind the wordmark. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[75dvh] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
        <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_30%,#F6F4EF_0%,#FFFFFF_70%)]" />
        <div className="cq-aurora-a absolute left-1/2 top-[6%] h-[360px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(199_255_47/0.17),rgb(199_255_47/0))] blur-3xl" />
        <div className="cq-aurora-b absolute left-1/2 top-[14%] h-[300px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgb(240_255_90/0.15),rgb(240_255_90/0))] blur-3xl" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center pb-8 pt-14 sm:pt-20">
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

        <div className="cq-rise mt-12 w-full sm:mt-16" style={delay(600)}>
          <BenefitsCarousel />
        </div>
      </main>

      <footer className="relative pb-32 text-center text-xs text-subtle">
        © {new Date().getFullYear()} Cromiqa
        {import.meta.env.VITE_STAGING && <span> · Staging: los envíos se simulan</span>}
      </footer>

      {leadsEnabled && <LeadDock />}
    </div>
  );
}
