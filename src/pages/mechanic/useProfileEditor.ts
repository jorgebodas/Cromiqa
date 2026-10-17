import { useEffect, useMemo, useState } from 'react';
import type { Mechanic, MechanicProfilePatch } from '@/domain/types';
import { validateMechanicPatch } from '@/domain/logic/garage';
import { useApp } from '@/state/store';

/** Local editable copy of part of a mechanic profile, with validation and save. */
export function useProfileEditor<K extends keyof MechanicProfilePatch>(mechanic: Mechanic, keys: K[]) {
  const pick = (m: Mechanic) => Object.fromEntries(keys.map((k) => [k, m[k]])) as Pick<Mechanic, K>;
  const [form, setForm] = useState(() => pick(mechanic));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const updateMechanic = useApp((s) => s.updateMechanic);
  const toast = useApp((s) => s.toast);

  const original = useMemo(() => JSON.stringify(pick(mechanic)), [mechanic]); // eslint-disable-line

  // Switching demo account to another mechanic: start from their profile.
  useEffect(() => {
    setForm(pick(mechanic));
    setErrors({});
  }, [mechanic.id]); // eslint-disable-line
  const dirty = JSON.stringify(form) !== original;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = (patch: Partial<Pick<Mechanic, K>>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const patch = form as MechanicProfilePatch;
    const e = validateMechanicPatch(patch);
    setErrors(e);
    if (Object.keys(e).length) {
      toast('Revisa los campos marcados', 'error');
      return false;
    }
    setSaving(true);
    try {
      await updateMechanic(patch);
      toast('Cambios guardados. Ya se ven en tu perfil público.');
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm(pick(mechanic));
    setErrors({});
  };

  return { form, set, errors, saving, dirty, save, discard };
}
