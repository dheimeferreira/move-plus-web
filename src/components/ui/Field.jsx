import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export function Field({ label, hint, error, children, className = '', required }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
          {label} {required ? <span className="text-brand" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, hint, error, className, required, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className} required={required}>
      {(a11y) => <input className="field" required={required} {...a11y} {...props} />}
    </Field>
  );
}

export function TextArea({ label, hint, error, className, required, rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className} required={required}>
      {(a11y) => <textarea className="field resize-y" rows={rows} required={required} {...a11y} {...props} />}
    </Field>
  );
}

export function Select({ label, hint, error, className, options, required, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className} required={required}>
      {(a11y) => (
        <div className="relative">
          <select className="field appearance-none pr-9" required={required} {...a11y} {...props}>
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        </div>
      )}
    </Field>
  );
}

/** Chips de filtro (radio visual). */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.key)}
            className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition ${active ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-card text-muted hover:text-fg'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full border border-line-strong bg-ink transition peer-checked:border-brand peer-checked:bg-brand/80 peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-muted transition peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-subtle">{description}</span> : null}
      </span>
    </label>
  );
}
