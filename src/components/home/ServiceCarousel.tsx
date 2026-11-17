import { SERVICE_TOPICS } from '@/domain/catalog';
import { useStartService } from '@/pages/owner/startRequest';
import { SERVICE_PHOTOS as PHOTOS } from './servicePhotos';

/**
 * Home's service carousel: small photo tiles with the name on the photo, in a native,
 * touch-scrolled row that bleeds to the screen edge, so part of the next card always shows.
 * No autoplay. A card opens the usual request flow with that service already chosen.
 */
export function ServiceCarousel() {
  const start = useStartService();
  return (
    <div
      className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 lg:-mx-8 lg:scroll-px-8 [&::-webkit-scrollbar]:hidden"
      data-testid="service-carousel"
    >
      <ul className="flex w-max gap-2.5 px-4 pb-2 sm:px-6 lg:px-8">
        {SERVICE_TOPICS.map((t) => (
          <li key={t.id} className="snap-start">
            <button
              type="button"
              onClick={() => start(t.id)}
              aria-label={`${t.label}: ${t.hint}`}
              className="group relative block h-[156px] w-[128px] overflow-hidden rounded-[22px] text-left transition-transform active:scale-[0.97]"
              data-testid="service-card"
            >
              <img src={PHOTOS[t.id]} alt="" width={600} height={360} loading="lazy" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgb(0_0_0/0.5))]" aria-hidden />
              <span className="absolute bottom-[11px] left-3 right-2 text-[14px] font-semibold leading-tight text-white">{t.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
