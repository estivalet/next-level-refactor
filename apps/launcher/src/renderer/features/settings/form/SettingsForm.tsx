import { GeneralSchema } from '@nextlevel/shared';
import { useMemo, type ReactNode } from 'react';
import { FieldControl } from './FieldControl.tsx';
import { fieldsOf, getAt, setAt } from './fields.ts';
import { SettingsSection } from './SettingsSection.tsx';
import type { SettingsDraft } from './useSettingsDraft.ts';

// Sections that are plain schema forms; others (Storage, Systems, …) render their own fields.
const SECTIONS = { general: GeneralSchema } as const;
export type FormSectionKey = keyof typeof SECTIONS;

/**
 * A settings section generated from the schema's field metadata (FR-SET-1); `extra` adds fields
 * that need their own control, below the generated ones.
 */
export function SettingsForm({
  sectionKey,
  extra,
}: {
  sectionKey: FormSectionKey;
  extra?: (form: SettingsDraft) => ReactNode;
}) {
  const fields = useMemo(() => fieldsOf(SECTIONS[sectionKey], sectionKey), [sectionKey]);
  return (
    <SettingsSection>
      {(form) => (
        <>
          {fields.map((field) => (
            <FieldControl
              key={field.path}
              field={field}
              value={getAt(form.draft, field.path)}
              error={form.errors[field.path]}
              onChange={(value) => {
                form.update((current) => setAt(current, field.path, value));
              }}
            />
          ))}
          {extra?.(form)}
        </>
      )}
    </SettingsSection>
  );
}
