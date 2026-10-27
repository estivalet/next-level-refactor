import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

const FIELD =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/30 focus:outline-none';

interface FieldProps {
  label: string;
  help?: string;
  error?: string | null;
}

function Frame({
  id,
  label,
  help,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-300">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-xs text-slate-500">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[#ff8a80]">
          {error}
        </p>
      )}
    </div>
  );
}

/** The ids of the help and error text, for the field's `aria-describedby`. */
function describedBy(id: string, help: string | undefined, error: string | null | undefined) {
  const ids = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/** A labelled text input with optional help and error text. */
export function TextField({
  label,
  help,
  error,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Frame id={id} label={label} {...(help ? { help } : {})} error={error ?? null}>
      <input
        id={id}
        className={FIELD}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
    </Frame>
  );
}

/** A labelled multi-line input. */
export function TextArea({
  label,
  help,
  error,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Frame id={id} label={label} {...(help ? { help } : {})} error={error ?? null}>
      <textarea
        id={id}
        className={`${FIELD} min-h-24 font-mono`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        {...rest}
      />
    </Frame>
  );
}
