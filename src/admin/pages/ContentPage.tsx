import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { Button, Card, FieldError, IconButton, Input, Spinner, Textarea } from '@/components/ui';
import { useApp } from '@/state/store';
import { publicFileUrl } from '@/services/supabase';
import { DEFAULT_BENEFITS, DEFAULT_PHOTOS, type Benefit, type StoredPhoto } from '@/marketing/siteContent';
import { loadContent, removePhotoFile, saveContent, uploadPhoto } from '../api';
import { useData } from '../useData';
import { ErrorBox, PageTitle } from './shared';

// Carousel photo cards are ~220×176 CSS px; store 2.4× for sharp retina rendering.
const PHOTO_W = 720;
const PHOTO_H = 540;

/** Cover-crop and compress an image client side to the carousel card size. */
async function prepareImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
    const w = img.width * scale, h = img.height * scale;
    const canvas = Object.assign(document.createElement('canvas'), { width: PHOTO_W, height: PHOTO_H });
    canvas.getContext('2d')!.drawImage(img, (PHOTO_W - w) / 2, (PHOTO_H - h) * 0.35, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', 0.8));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function BenefitsEditor({ initial }: { initial: Benefit[] | null }) {
  const toast = useApp((s) => s.toast);
  const [items, setItems] = useState<Benefit[]>(initial ?? DEFAULT_BENEFITS);
  const [saved, setSaved] = useState(JSON.stringify(initial ?? DEFAULT_BENEFITS));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(items) !== saved;
  const set = (i: number, p: Partial<Benefit>) => setItems((l) => l.map((b, k) => (k === i ? { ...b, ...p } : b)));

  const save = async () => {
    const clean = items.map((b) => ({ title: b.title.trim(), text: b.text.trim() }));
    if (clean.some((b) => !b.title || !b.text)) return setError('Cada tarjeta necesita título y texto.');
    if (clean.some((b) => b.title.length > 40 || b.text.length > 120)) return setError('Máximo 40 caracteres en el título y 120 en el texto.');
    setError(undefined);
    setSaving(true);
    try {
      await saveContent('benefits', clean);
      setSaved(JSON.stringify(clean));
      setItems(clean);
      toast('Textos publicados en la web');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Textos del carrusel</h2>
          <p className="text-sm text-muted">{initial ? 'Publicados desde el panel.' : 'Ahora la web muestra los textos por defecto.'}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setItems((l) => [...l, { title: '', text: '' }])}>Añadir tarjeta</Button>
      </div>
      <ol className="mt-4 space-y-3">
        {items.map((b, i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-line p-3" data-testid="benefit-row">
            <span className="mt-3 w-5 text-center text-sm font-semibold text-muted tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <Input aria-label={`Título ${i + 1}`} value={b.title} maxLength={40} onChange={(e) => set(i, { title: e.target.value })} placeholder="Título" />
              <Textarea aria-label={`Texto ${i + 1}`} value={b.text} maxLength={120} rows={2} onChange={(e) => set(i, { text: e.target.value })} placeholder="Texto breve" className="min-h-0" />
            </div>
            <div className="flex flex-col">
              <IconButton label="Subir" onClick={() => setItems((l) => move(l, i, -1))} disabled={i === 0}><ArrowUp className="size-4" /></IconButton>
              <IconButton label="Bajar" onClick={() => setItems((l) => move(l, i, 1))} disabled={i === items.length - 1}><ArrowDown className="size-4" /></IconButton>
              <IconButton label={`Quitar tarjeta ${i + 1}`} onClick={() => setItems((l) => l.filter((_, k) => k !== i))} disabled={items.length <= 1} className="hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></IconButton>
            </div>
          </li>
        ))}
      </ol>
      {error && <div className="mt-3"><FieldError>{error}</FieldError></div>}
      <div className="mt-4 flex justify-end gap-2">
        {dirty && <Button variant="ghost" onClick={() => setItems(JSON.parse(saved))}>Descartar</Button>}
        <Button onClick={save} disabled={!dirty} loading={saving}>Publicar textos</Button>
      </div>
    </Card>
  );
}

function PhotosEditor({ initial }: { initial: StoredPhoto[] | null }) {
  const toast = useApp((s) => s.toast);
  const [items, setItems] = useState<StoredPhoto[]>(initial ?? []);
  const [saved, setSaved] = useState(JSON.stringify(initial ?? []));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(items) !== saved;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of [...files]) {
        if (!f.type.startsWith('image/')) throw new Error(`${f.name} no es una imagen.`);
        const path = await uploadPhoto(await prepareImage(f));
        setItems((l) => [...l, { path, alt: '' }]);
      }
      toast('Fotos subidas. Añade una descripción y publica.', 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir la foto', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (items.some((p) => !p.alt.trim())) return toast('Añade una descripción a cada foto (accesibilidad).', 'error');
    setSaving(true);
    try {
      const clean = items.map((p) => ({ path: p.path, alt: p.alt.trim() }));
      await saveContent('photos', clean);
      // Clean up files removed from the list.
      const removed = (JSON.parse(saved) as StoredPhoto[]).filter((o) => !clean.some((p) => p.path === o.path));
      await Promise.all(removed.map((p) => removePhotoFile(p.path)));
      setSaved(JSON.stringify(clean));
      setItems(clean);
      toast('Fotos publicadas en la web');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">Fotos del carrusel</h2>
          <p className="text-sm text-muted">
            {initial ? 'Se alternan con los textos en este orden.' : `Ahora la web muestra las ${DEFAULT_PHOTOS.length} fotos incluidas en el código. Al publicar fotos desde aquí, las sustituyen.`}
          </p>
        </div>
        <Button variant="secondary" size="sm" loading={uploading} icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>Subir fotos</Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFiles(e.target.files)} />
      </div>
      {!initial && DEFAULT_PHOTOS.length > 0 && items.length === 0 && (
        <ul className="mt-4 grid grid-cols-3 gap-2 opacity-70 sm:grid-cols-6" aria-label="Fotos incluidas actualmente">
          {DEFAULT_PHOTOS.map((p) => <li key={p.src}><img src={p.src} alt={p.alt} className="aspect-[4/3] w-full rounded-xl object-cover" /></li>)}
        </ul>
      )}
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((p, i) => (
          <li key={p.path} className="flex gap-3 rounded-2xl border border-line p-3">
            <img src={publicFileUrl(p.path)} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-xl bg-sand object-cover" />
            <div className="min-w-0 flex-1">
              <label className="text-xs font-medium text-muted" htmlFor={`alt-${i}`}>Descripción (para lectores de pantalla)</label>
              <Input id={`alt-${i}`} value={p.alt} maxLength={120} onChange={(e) => setItems((l) => l.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} placeholder="Ej.: Mecánico ajustando frenos" className="mt-1 h-10" />
              <div className="mt-1 flex">
                <IconButton label="Mover antes" onClick={() => setItems((l) => move(l, i, -1))} disabled={i === 0}><ArrowUp className="size-4" /></IconButton>
                <IconButton label="Mover después" onClick={() => setItems((l) => move(l, i, 1))} disabled={i === items.length - 1}><ArrowDown className="size-4" /></IconButton>
                <IconButton label="Quitar foto" onClick={() => setItems((l) => l.filter((_, k) => k !== i))} className="hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></IconButton>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">Las fotos se recortan en horizontal (4:3) y se comprimen automáticamente al subirlas.</p>
      <div className="mt-4 flex justify-end gap-2">
        {dirty && <Button variant="ghost" onClick={() => setItems(JSON.parse(saved))}>Descartar</Button>}
        <Button onClick={save} disabled={!dirty} loading={saving}>Publicar fotos</Button>
      </div>
    </Card>
  );
}

export function ContentPage() {
  const load = useCallback(loadContent, []);
  const { data, error, loading, reload } = useData(load);
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [data]);
  return (
    <>
      <PageTitle title="Contenido de la web" description="Lo que publiques aquí aparece en cromiqa.com en la siguiente visita. No hace falta tocar código." />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-6" key={key}>
          <BenefitsEditor initial={data.benefits} />
          <PhotosEditor initial={data.photos} />
        </div>
      ) : null}
    </>
  );
}
