import type { SystemInfo } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from './formErrors.ts';
import { TextField, YearField } from './FormFields.tsx';

export type TextKey = {
  [K in keyof SystemInfo]-?: SystemInfo[K] extends string | undefined ? K : never;
}[keyof SystemInfo];
export type YearKey = 'releaseYear' | 'discontinuedYear';

export type FieldSpec = { key: TextKey; kind: 'text' | 'area' } | { key: YearKey; kind: 'year' };

/** A run of the entry's scalar fields: single-line, multi-line and year inputs. */
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
