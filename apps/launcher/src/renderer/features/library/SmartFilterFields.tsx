import { SMART_FILTER_PLAYED, SMART_FILTER_SORTS } from '@nextlevel/shared';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT } from './Modal.tsx';
import type { SmartField, SmartForm } from './smartFilterForm.ts';

type TextField = Exclude<SmartField, 'systems' | 'favorite' | 'played' | 'sort'>;

/** The smart filter's fields (D10); a field's message shows once it has been edited. */
export function SmartFilterFields({
  form,
  errors,
  systems,
  onChange,
}: {
  form: SmartForm;
  errors: Partial<Record<SmartField, string>>;
  /** Enabled systems the filter can be limited to. */
  systems: ReadonlyArray<{ id: string; name: string }>;
  onChange: (patch: Partial<SmartForm>) => void;
}) {
  const { t } = useTranslation();
  const text = (field: TextField, numeric = false) => (
    <Field label={t(`library.smart.fields.${field}`)} error={errors[field]}>
      {(id) => (
        <input
          id={id}
          className={INPUT}
          value={form[field]}
          inputMode={numeric ? 'numeric' : undefined}
          aria-invalid={errors[field] !== undefined}
          onChange={(event) => {
            onChange({ [field]: event.target.value });
          }}
        />
      )}
    </Field>
  );
  return (
    <div className="space-y-3 text-xs">
      {text('name')}
      <fieldset className="space-y-1">
        <legend className="text-slate-400">{t('library.smart.fields.systems')}</legend>
        <p className="text-[11px] text-slate-500">{t('library.smart.fields.systemsHint')}</p>
        <div className="grid max-h-28 grid-cols-2 gap-1 overflow-y-auto">
          {systems.map((system) => (
            <label key={system.id} className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={form.systems.includes(system.id)}
                onChange={(event) => {
                  onChange({
                    systems: event.target.checked
                      ? [...form.systems, system.id]
                      : form.systems.filter((id) => id !== system.id),
                  });
                }}
              />
              <span className="truncate">{system.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={form.favorite}
          onChange={(event) => {
            onChange({ favorite: event.target.checked });
          }}
        />
        {t('library.smart.fields.favorite')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {text('genre')}
        {text('filters')}
        {text('yearFrom', true)}
        {text('yearTo', true)}
        {text('minPlayers', true)}
        {text('playedWithinDays', true)}
        <Field label={t('library.smart.fields.played')}>
          {(id) => (
            <select
              id={id}
              className={INPUT}
              value={form.played}
              onChange={(event) => {
                onChange({ played: event.target.value as SmartForm['played'] });
              }}
            >
              {SMART_FILTER_PLAYED.map((value) => (
                <option key={value} value={value}>
                  {t(`library.smart.played.${value}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('library.smart.fields.sort')}>
          {(id) => (
            <select
              id={id}
              className={INPUT}
              value={form.sort}
              onChange={(event) => {
                onChange({ sort: event.target.value as SmartForm['sort'] });
              }}
            >
              {SMART_FILTER_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(`library.smart.sort.${value}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {text('limit', true)}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: (id: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-slate-400">
        {label}
      </label>
      {children(id)}
      {error && <p className="mt-0.5 text-[11px] text-red-300">{t(error)}</p>}
    </div>
  );
}
