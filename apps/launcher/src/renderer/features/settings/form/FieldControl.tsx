import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldDescriptor } from './fields.ts';

const FOCUS = 'focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/** One settings field: label, control, help text and the field's validation message. */
export function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  error: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [field.helpKey && helpId, error && errorId].filter(Boolean).join(' ');

  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} id={`${id}-label`} className="text-sm font-medium text-white">
          {t(field.labelKey)}
        </label>
        {field.helpKey && (
          <p id={helpId} className="text-xs text-slate-400">
            {t(field.helpKey)}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-[#ff8a80]">
            {t(error)}
          </p>
        )}
      </div>
      {field.kind === 'boolean' ? (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={value === true}
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy || undefined}
          onClick={() => {
            onChange(value !== true);
          }}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            value === true ? 'bg-[#990033]' : 'bg-white/20'
          } ${FOCUS}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              value === true ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ) : (
        <select
          id={id}
          value={String(value)}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={`rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white ${FOCUS}`}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {t(`${field.labelKey.replace(/\.label$/, '')}.options.${option}`)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
