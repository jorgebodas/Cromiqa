// Content of the public carousel. Source of truth: Supabase `site_content` (edited from the
// admin panel). Falls back to the texts and photos bundled with the site, and caches the last
// version so returning visitors don't see it change after load.
import { useEffect, useState } from 'react';
import { getSupabase, publicFileUrl, supabaseConfigured } from '@/services/supabase';

export interface Benefit {
  title: string;
  text: string;
}
export interface Photo {
  src: string;
  alt: string;
}
/** Stored shape of a photo in site_content (path inside the `site` bucket). */
export interface StoredPhoto {
  path: string;
  alt: string;
}

// Order matters: need → transparency → convenience → trust → inspection. Each one is paired
// with the bundled photo at the same position.
// The title is the one big sentence shown on the landing; *asterisks* mark the highlighted
// words (without them, the last word is highlighted). The text is read by screen readers.
export const DEFAULT_BENEFITS: Benefit[] = [
  { title: 'Cuéntanos qué le pasa a tu *bici*', text: 'Cuéntanos qué le pasa a tu bici y te ayudamos a encontrar al profesional adecuado.' },
  { title: 'Precios *claros* antes de pedir nada', text: 'Consulta precios orientativos antes de pedir nada y decide con más tranquilidad.' },
  { title: 'En casa o en el taller, *tú eliges*', text: 'A domicilio o en taller. Elige la opción que mejor encaje contigo y con tu bici.' },
  { title: 'Mecánicos de *confianza*, cerca de ti', text: 'Profesionales especializados, con experiencia y valorados por otros ciclistas.' },
  { title: 'Revisa una bici usada *antes de comprar*', text: 'Haz revisar una bici de segunda mano antes de pagar y compra con más seguridad.' },
];

// Bundled photos: any image in src/assets/mechanics/. File name → alt text
// ("2-manos-ajustando-la-transmision.jpg" → "Manos ajustando la transmisión").
const PHOTO_FILES = import.meta.glob<string>('../assets/mechanics/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
});

export function altFromFileName(path: string) {
  const words = path.split('/').pop()!.replace(/\.[^.]+$/, '').replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim();
  const accented = words.replace(/mecanic([oa])/gi, 'mecánic$1').replace(/transmision/gi, 'transmisión');
  return accented ? accented[0]!.toUpperCase() + accented.slice(1) : 'Mecánico de bicicletas trabajando';
}

export const DEFAULT_PHOTOS: Photo[] = Object.entries(PHOTO_FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => ({ src, alt: altFromFileName(path) }));

export interface SiteContent {
  benefits: Benefit[];
  photos: Photo[];
}

// Versioned so visitors don't briefly see a cached carousel from before the copy update.
const CACHE_KEY = 'cromiqa:site-content:v3';
const DEFAULTS: SiteContent = { benefits: DEFAULT_BENEFITS, photos: DEFAULT_PHOTOS };

const isBenefits = (v: unknown): v is Benefit[] =>
  Array.isArray(v) && v.every((b) => b && typeof b.title === 'string' && typeof b.text === 'string');
const isStoredPhotos = (v: unknown): v is StoredPhoto[] =>
  Array.isArray(v) && v.every((p) => p && typeof p.path === 'string' && typeof p.alt === 'string');

export async function fetchSiteContent(): Promise<SiteContent | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('site_content').select('key, value');
  if (error || !data) return null;
  const byKey = Object.fromEntries(data.map((r: { key: string; value: unknown }) => [r.key, r.value]));
  return {
    benefits: isBenefits(byKey.benefits) && byKey.benefits.length ? byKey.benefits : DEFAULT_BENEFITS,
    photos: isStoredPhotos(byKey.photos) ? byKey.photos.map((p) => ({ src: publicFileUrl(p.path), alt: p.alt })) : DEFAULT_PHOTOS,
  };
}

function readCache(): SiteContent | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return c && isBenefits(c.benefits) && Array.isArray(c.photos) ? c : null;
  } catch {
    return null;
  }
}

export function useSiteContent(): SiteContent {
  const [content, setContent] = useState<SiteContent>(() => (supabaseConfigured && readCache()) || DEFAULTS);
  useEffect(() => {
    let alive = true;
    fetchSiteContent()
      .then((c) => {
        if (!alive || !c) return;
        setContent(c);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(c));
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return content;
}

/** One carousel card: a benefit with its photo behind it. */
export type Slide = Benefit & { photo?: Photo };

/** Each benefit gets a photo (photos cycle if there are fewer than texts). */
export function buildSlides({ benefits, photos }: SiteContent): Slide[] {
  return benefits.map((b, i) => ({ ...b, photo: photos.length ? photos[i % photos.length] : undefined }));
}
