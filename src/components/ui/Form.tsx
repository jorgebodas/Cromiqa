import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { cx } from './cx';

const control =
  'block w-full rounded-xl border bg-paper px-4 text-base text-ink sm:text-[15px] placeholder:text-subtle transition-colors ' +
  'focus:outline-none focus-visible:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:bg-sand disabled:text-muted';

const borderFor = (invalid?: boolean) => (invalid ? 'border-danger' : 'border-line-strong hover:border-muted');

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
    : children;
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-muted">Opcional</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(control, 'h-12', borderFor(!!rest['aria-invalid']), className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(control, 'py-3 leading-relaxed resize-y min-h-24', borderFor(!!rest['aria-invalid']), className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx(control, 'h-12 appearance-none pr-10', borderFor(!!rest['aria-invalid']), className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  name: string;
  value: string;
  disabled?: boolean;
  aside?: ReactNode;
  className?: string;
}

/** A large radio option. Native radio input for keyboard + screen reader support. */
export function ChoiceCard({ selected, onSelect, title, description, icon, name, value, disabled, aside, className }: ChoiceCardProps) {
  return (
    <label
      className={cx(
        'group relative flex cursor-pointer items-start gap-3 rounded-2xl border bg-paper p-4 transition-all',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
        selected ? 'border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="sr-only"
      />
      {icon && (
        <span
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
            selected ? 'bg-ink text-paper' : 'bg-sand text-ink',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-sm leading-snug text-muted">{description}</span>}
        {aside}
      </span>
      <span
        className={cx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-ink bg-lime' : 'border-line-strong bg-paper',
        )}
        aria-hidden
      >
        {selected && <Check className="size-3.5 text-ink" strokeWidth={3} />}
      </span>
    </label>
  );
}

interface ToggleChipProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Multi-select chip (aria-pressed). */
export function ToggleChip({ pressed, onToggle, children, icon, className }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cx(
        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        pressed ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper text-ink hover:border-ink',
        className,
      )}
    >
      {pressed ? <Check className="size-4 text-lime" strokeWidth={3} aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          checked ? 'border-ink bg-ink' : 'border-line-strong bg-paper',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3.5 text-lime" strokeWidth={3} />}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'border-ink bg-ink' : 'border-line-strong bg-sand-deep',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-5.5 rounded-full transition-all',
            checked ? 'left-[22px] bg-lime' : 'left-0.5 bg-paper shadow',
          )}
        />
      </button>
    </div>
  );
}
