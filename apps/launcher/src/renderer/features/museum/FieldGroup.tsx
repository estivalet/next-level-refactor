import { SYSTEM_KINDS, type SystemInfo } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from './formErrors.ts';
import { SelectField, TextField, YearField } from './FormFields.tsx';

/** Free-text fields; `kind` is a fixed choice, edited through its own select. */
export type TextKey = Exclude<
  {
    [K in keyof SystemInfo]-?: SystemInfo[K] extends string | undefined ? K : never;
  }[keyof SystemInfo],
  'kind'
>;
export type YearKey = 'releaseYear' | 'discontinuedYear';

export type FieldSpec =
  | { key: TextKey; kind: 'text' | 'area' }
  | { key: YearKey; kind: 'year' }
  | { key: 'kind'; kind: 'systemKind' };

/** A run of the entry's scalar fields: single-line, multi-line, year and Type inputs. */
export function FieldGroup({
  fields,
  draft,
  errors,
  onChange,
}: {
  fields: readonly FieldSpec[];
  draft: SystemInfo;
  errors: FieldErrors;
  onChange: (patch: Partial<SystemInfo>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => {
        const label = t(`apps.museum.field.${field.key}`);
        if (field.kind === 'systemKind') {
          // Served entries always carry a kind (FR-MUS-10); 'other' only guards a stray draft.
          return (
            <SelectField
              key={field.key}
              label={label}
              value={draft.kind ?? 'other'}
              options={SYSTEM_KINDS.map((kind) => ({
                value: kind,
                label: t(`settings.systems.custom.kinds.${kind}`),
              }))}
              onChange={(kind) => {
                onChange({ kind });
              }}
            />
          );
        }
        if (field.kind === 'year') {
          return (
            <YearField
              key={field.key}
              label={label}
              value={draft[field.key]}
              error={errors[field.key]}
              onChange={(value) => {
                onChange({ [field.key]: value });
              }}
            />
          );
        }
        return (
          <div key={field.key} className={field.kind === 'area' ? 'col-span-2' : undefined}>
            <TextField
              label={label}
              multiline={field.kind === 'area'}
              value={draft[field.key]}
              error={errors[field.key]}
              onChange={(value) => {
                onChange({ [field.key]: value });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
