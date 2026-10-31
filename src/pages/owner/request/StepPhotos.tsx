import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { MAX_PHOTOS } from '@/domain/logic/requests';
import type { RequestDraft } from '@/state/store';
import { FieldError } from '@/components/ui';

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_SIDE = 1024;

/**
 * Downscales a photo to at most 1024 px and re-encodes it as JPEG, so a few photos fit in the
 * demo's local storage. A real backend would upload the original to object storage instead.
 */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Optional photos of the problem: preview, remove, and validation (type, size, count). */
export function StepPhotos({ draft, set, error }: { draft: RequestDraft; set: (patch: Partial<RequestDraft>) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const left = MAX_PHOTOS - draft.photos.length;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setProblem(undefined);
    const picked = Array.from(files);
    const valid = picked.filter((f) => f.type.startsWith('image/') && f.size <= MAX_INPUT_BYTES);
    if (valid.length < picked.length) setProblem('Solo se admiten imágenes de hasta 12 MB.');
    if (valid.length > left) setProblem(`Puedes adjuntar ${MAX_PHOTOS} fotos como máximo.`);
    setBusy(true);
    try {
      const encoded: string[] = [];
      for (const f of valid.slice(0, left)) {
        try {
          encoded.push(await compress(f));
        } catch {
          setProblem('No pudimos leer alguna de las fotos. Prueba con otra.');
        }
      }
      if (encoded.length) set({ photos: [...draft.photos, ...encoded] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-4" id="field-photos" tabIndex={-1}>
      <p className="text-[15px] text-muted">Opcional. Una foto del problema ayuda al mecánico a darte un presupuesto más ajustado.</p>
      <ul className="grid grid-cols-3 gap-3" data-testid="photo-previews">
        {draft.photos.map((src, i) => (
          <li key={i} className="relative aspect-square overflow-hidden rounded-2xl bg-canvas">
            <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => set({ photos: draft.photos.filter((_, j) => j !== i) })}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur hover:bg-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
        {left > 0 && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition-colors hover:border-ink hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
              <Camera className="size-6" aria-hidden />
              {busy ? 'Procesando…' : 'Añadir foto'}
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                disabled={busy}
                onChange={(e) => void add(e.target.files)}
                aria-label="Añadir fotos del problema"
                data-testid="photo-input"
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-sm text-muted">
        {draft.photos.length} de {MAX_PHOTOS} fotos
      </p>
      {(problem || error) && <FieldError>{problem ?? error}</FieldError>}
    </div>
  );
}
