import {
  GeneralSchema,
  SettingsSchema,
  changedPaths,
  type Settings,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode, useSaveSettings, useSettings } from '../settingsApi.ts';
import { FieldControl } from './FieldControl.tsx';
import { fieldsOf, getAt, issuesByPath, setAt } from './fields.ts';
import { SaveBar } from './SaveBar.tsx';

// Sections that are plain schema forms; others (Backups, Data & logs) have their own screens.
const SECTIONS = { general: GeneralSchema } as const;
export type FormSectionKey = keyof typeof SECTIONS;

/** A settings section generated from the schema, with a draft and the save bar (S9). */
export function SettingsForm({ sectionKey }: { sectionKey: FormSectionKey }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [notice, setNotice] = useState<string | null>(null);
  // After this form saves, the fresh draft takes keyboard focus (the save bar it came from is gone).
  const [focusAfterSave, setFocusAfterSave] = useState(false);
  if (settings.data?.kind !== 'ok') return null;
  const { snapshot } = settings.data;

  return (
    <div className="flex h-full flex-col">
      {notice && (
        <p role="status" className="mx-6 mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs text-white">
          {t(notice)}
        </p>
      )}
      {/* A new revision (save, conflict reload, restore) starts a fresh draft. */}
      <FormBody
        key={snapshot.revision}
        sectionKey={sectionKey}
        snapshot={snapshot}
        onNotice={setNotice}
        focusFirstField={focusAfterSave}
        onSaved={() => {
          setFocusAfterSave(true);
        }}
      />
    </div>
  );
}

function FormBody({
  sectionKey,
  snapshot,
  onNotice,
  focusFirstField,
  onSaved,
}: {
  sectionKey: FormSectionKey;
  snapshot: SettingsSnapshot;
  onNotice: (key: string | null) => void;
  focusFirstField: boolean;
  onSaved: () => void;
}) {
  const fieldsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusFirstField) fieldsRef.current?.querySelector<HTMLElement>('select, button')?.focus();
  }, [focusFirstField]);
  const client = useQueryClient();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<Settings>(snapshot.settings);
  const fields = useMemo(() => fieldsOf(SECTIONS[sectionKey], sectionKey), [sectionKey]);
  const validation = SettingsSchema.safeParse(draft);
  const errors = validation.success ? {} : issuesByPath(validation.error);
  const dirty = changedPaths(snapshot.settings, draft).length > 0;

  function submit() {
    onNotice(null);
    save.mutate(
      { settings: draft, baseRevision: snapshot.revision },
      {
        onSuccess: onSaved,
        onError: (error) => {
          const code = errorCode(error);
          onNotice(code === 'CONFLICT' ? 'errors.conflict' : 'errors.internal');
          if (code === 'CONFLICT') void client.invalidateQueries({ queryKey: ['settings'] });
        },
      },
    );
  }

  return (
    <>
      <div ref={fieldsRef} className="flex-1 px-6">
        {fields.map((field) => (
          <FieldControl
            key={field.path}
            field={field}
            value={getAt(draft, field.path)}
            error={errors[field.path]}
            onChange={(value) => {
              setDraft((current) => setAt(current, field.path, value));
            }}
          />
        ))}
      </div>
      {dirty && (
        <SaveBar
          valid={validation.success}
          saving={save.isPending}
          onSave={submit}
          onDiscard={() => {
            setDraft(snapshot.settings);
          }}
        />
      )}
    </>
  );
}
