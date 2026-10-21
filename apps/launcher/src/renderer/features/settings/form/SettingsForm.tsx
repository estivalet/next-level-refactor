import { GeneralSchema } from '@nextlevel/shared';
import { useMemo } from 'react';
import { FieldControl } from './FieldControl.tsx';
import { fieldsOf, getAt, setAt } from './fields.ts';
import { SettingsSection } from './SettingsSection.tsx';

// Sections that are plain schema forms; others (Storage, Systems, …) render their own fields.
const SECTIONS = { general: GeneralSchema } as const;
export type FormSectionKey = keyof typeof SECTIONS;

/** A settings section generated from the schema's field metadata (FR-SET-1). */
export function SettingsForm({ sectionKey }: { sectionKey: FormSectionKey }) {
  const fields = useMemo(() => fieldsOf(SECTIONS[sectionKey], sectionKey), [sectionKey]);
  return (
    <SettingsSection>
      {({ draft, update, errors }) =>
        fields.map((field) => (
          <FieldControl
            key={field.path}
            field={field}
            value={getAt(draft, field.path)}
            error={errors[field.path]}
            onChange={(value) => {
              update((current) => setAt(current, field.path, value));
            }}
          />
        ))
      }
    </SettingsSection>
  );
}
