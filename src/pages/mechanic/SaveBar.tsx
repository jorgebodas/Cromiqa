import { Button, cx } from '@/components/ui';

/** Sticky save bar shown for profile editors; makes unsaved state obvious. */
export function SaveBar({ dirty, saving, onSave, onDiscard }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className={cx('sticky bottom-16 z-30 mt-8 md:bottom-4', !dirty && 'pointer-events-none')}>
      <div
        className={cx(
          'flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper/95 p-3 shadow-card backdrop-blur transition-opacity sm:p-4',
          dirty ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden={!dirty}
      >
        <p className="text-sm font-medium">Tienes cambios sin guardar</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} tabIndex={dirty ? 0 : -1}>
            Descartar
          </Button>
          <Button size="sm" onClick={onSave} loading={saving} tabIndex={dirty ? 0 : -1}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
