import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { Bike, BikeInput } from '@/domain/types';
import { BIKE_TYPES } from '@/domain/catalog';
import { validateBike } from '@/domain/logic/garage';
import { Button, Dialog, Field, FieldError, Input, Select, Textarea } from '@/components/ui';

/** Downscale an image file to a small JPEG data URL so it fits in LocalStorage. */
export async function fileToSmallDataUrl(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const empty: BikeInput = { name: '', brand: '', model: '', type: 'mtb', notes: '' };

export function BikeFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Bike;
  onSave: (input: BikeInput) => Promise<void>;
}) {
  const [form, setForm] = useState<BikeInput>(initial ? { ...initial } : empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<BikeInput>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const e = validateBike(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave({ ...form, notes: form.notes?.trim() || undefined });
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const onPhoto = async (file?: File) => {
    setPhotoError(undefined);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoError('El archivo debe ser una imagen.');
    if (file.size > 15 * 1024 * 1024) return setPhotoError('La imagen es demasiado grande (máx. 15 MB).');
    try {
      set({ photo: await fileToSmallDataUrl(file) });
    } catch {
      setPhotoError('No pudimos leer la imagen.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Editar bici' : 'Añadir bici'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {initial ? 'Guardar cambios' : 'Añadir al garaje'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre" error={errors.name} hint="Cómo la llamas tú. Ej.: “La de monte”.">
          <Input name="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Marca" error={errors.brand}>
            <Input name="brand" value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
          </Field>
          <Field label="Modelo" error={errors.model}>
            <Input name="model" value={form.model} onChange={(e) => set({ model: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select name="type" value={form.type} onChange={(e) => set({ type: e.target.value as BikeInput['type'] })}>
              {BIKE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Año" optional error={errors.year}>
            <Input
              name="year"
              type="number"
              inputMode="numeric"
              value={form.year ?? ''}
              onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        </div>
        <Field label="Notas" optional hint="Componentes, talla, modificaciones…">
          <Textarea name="notes" rows={2} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">
            Foto <span className="font-normal text-muted">· opcional, se guarda solo en este navegador</span>
          </p>
          {form.photo ? (
            <div className="flex items-center gap-3">
              <img src={form.photo} alt="Vista previa de la bici" className="h-20 w-28 rounded-xl object-cover" />
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => set({ photo: undefined })}>
                Quitar foto
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
              Subir foto
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
          {photoError && <div className="mt-2"><FieldError>{photoError}</FieldError></div>}
        </div>
        {errors.form && <FieldError>{errors.form}</FieldError>}
      </div>
    </Dialog>
  );
}
