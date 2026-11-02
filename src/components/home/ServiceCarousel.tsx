import { SERVICE_TOPICS } from '@/domain/catalog';
import type { ServiceTopic } from '@/domain/types';
import { useStartService } from '@/pages/owner/startRequest';
import maintenance from '@/assets/services/maintenance.jpg';
import brakes from '@/assets/services/brakes.jpg';
import drivetrain from '@/assets/services/drivetrain.jpg';
import wheels from '@/assets/services/wheels.jpg';
import suspension from '@/assets/services/suspension.jpg';
import diagnosis from '@/assets/services/diagnosis.jpg';

const PHOTOS: Record<ServiceTopic, string> = { maintenance, brakes, drivetrain, wheels, suspension, diagnosis };

/**
 * Home's service carousel: fixed-width cards (photo 5:3, name, a few words) in a native,
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
      <ul className="flex w-max gap-3 px-4 pb-2 sm:px-6 lg:px-8">
        {SERVICE_TOPICS.map((t) => (
          <li key={t.id} className="snap-start">
            <button
              type="button"
              onClick={() => start(t.id)}
              className="surface group block w-[232px] overflow-hidden text-left transition-transform active:scale-[0.98] sm:w-[260px]"
              data-testid="service-card"
            >
              <img src={PHOTOS[t.id]} alt="" width={600} height={360} loading="lazy" className="aspect-[5/3] w-full object-cover" />
              <span className="block px-4 pb-4 pt-3">
                <span className="block font-display text-[17px] font-bold tracking-tight">{t.label}</span>
                <span className="mt-0.5 block text-sm text-muted">{t.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
