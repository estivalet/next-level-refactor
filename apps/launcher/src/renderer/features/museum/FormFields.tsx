import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from '../library/Modal.tsx';

interface BaseProps {
  label: string;
  /** An i18n key. */
  error?: string | undefined;
}

function Shell({
  label,
  error,
  id,
  children,
}: BaseProps & { id: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-slate-400">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[11px] text-[#ff8a80]">
          {t(error)}
        </p>
      )}
    </div>
  );
}

/** Text input or textarea; an empty field reads as absent (`undefined`). */
export function TextField({
  label,
  error,
  value,
  onChange,
  multiline = false,
}: BaseProps & {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  multiline?: boolean;
}) {
  const id = useId();
  const shared = {
    id,
    className: INPUT,
    value: value ?? '',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  };
  return (
    <Shell label={label} error={error} id={id}>
      {multiline ? (
        <textarea
          {...shared}
          rows={4}
          onChange={(event) => {
            onChange(event.target.value === '' ? undefined : event.target.value);
          }}
        />
      ) : (
        <input
          {...shared}
          type="text"
          onChange={(event) => {
            onChange(event.target.value === '' ? undefined : event.target.value);
          }}
        />
      )}
    </Shell>
  );
}

/** A select over fixed options; `options` pairs each value with its (translated) label. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: BaseProps & {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Shell label={label} id={id}>
      <select
        id={id}
        className={INPUT}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as T);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

/** Year input; an empty field is `undefined`, never 0. */
export function YearField({
  label,
  error,
  value,
  onChange,
}: BaseProps & { value: number | undefined; onChange: (value: number | undefined) => void }) {
  const id = useId();
  return (
    <Shell label={label} error={error} id={id}>
      <input
        id={id}
        type="number"
        className={INPUT}
        value={value ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          onChange(event.target.value === '' ? undefined : Number(event.target.value));
        }}
      />
    </Shell>
  );
}
