import type { SettingsSnapshot } from '@nextlevel/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settingsApi.ts';
import { SaveBar } from './SaveBar.tsx';
import { useSettingsDraft, type SettingsDraft } from './useSettingsDraft.ts';

/**
 * Frame for a settings section that edits the settings file: it owns the draft, the notice line
 * and the save bar; `children` renders the fields from the draft (S9).
 */
export function SettingsSection({ children }: { children: (draft: SettingsDraft) => ReactNode }) {
  const { t } = useTranslation();
  const settings = useSettings();
  const [notice, setNotice] = useState<string | null>(null);
  // After this section saves, the first field takes keyboard focus (the save bar is gone).
  const [saves, setSaves] = useState(0);
  if (settings.data?.kind !== 'ok') return null;
  const { snapshot } = settings.data;

  return (
    <div className="flex h-full flex-col">
      {notice && (
        <p role="status" className="mx-6 mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs text-white">
          {t(notice)}
        </p>
      )}
      {/* A new revision rebases the draft instead of remounting it (useSettingsDraft). */}
      <DraftBody
        snapshot={snapshot}
        onNotice={setNotice}
        saves={saves}
        onSaved={() => {
          setSaves((count) => count + 1);
        }}
      >
        {children}
      </DraftBody>
    </div>
  );
}

function DraftBody({
  snapshot,
  onNotice,
  saves,
  onSaved,
  children,
}: {
  snapshot: SettingsSnapshot;
  onNotice: (key: string | null) => void;
  saves: number;
  onSaved: () => void;
  children: (draft: SettingsDraft) => ReactNode;
}) {
  const fieldsRef = useRef<HTMLDivElement>(null);
  const draft = useSettingsDraft(snapshot, { onSaved, onNotice });

  useEffect(() => {
    if (saves === 0) return;
    fieldsRef.current?.querySelector<HTMLElement>('input, select, button')?.focus();
  }, [saves]);

  return (
    <>
      <div ref={fieldsRef} className="flex-1 px-6">
        {children(draft)}
      </div>
      {draft.dirty && (
        <SaveBar
          valid={draft.valid}
          saving={draft.saving}
          onSave={draft.save}
          onDiscard={draft.discard}
        />
      )}
    </>
  );
}
