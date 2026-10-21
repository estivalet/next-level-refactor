import {
  SettingsSchema,
  changedPaths,
  type Settings,
  type SettingsSnapshot,
} from '@nextlevel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorCode, useSaveSettings } from '../settingsApi.ts';
import { issuesByPath } from './fields.ts';

export interface SettingsDraft {
  draft: Settings;
  update: (change: (settings: Settings) => Settings) => void;
  /** Dotted field path → message key, for the whole draft (FR-SET-2). */
  errors: Record<string, string>;
  valid: boolean;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  discard: () => void;
}

/**
 * A local copy of the settings that a section edits, validated on every change with the shared
 * schema. Saving sends the base revision; a CONFLICT reloads the settings (and so the draft).
 */
export function useSettingsDraft(
  snapshot: SettingsSnapshot,
  { onSaved, onNotice }: { onSaved: () => void; onNotice: (key: string | null) => void },
): SettingsDraft {
  const client = useQueryClient();
  const mutation = useSaveSettings();
  const [draft, setDraft] = useState<Settings>(snapshot.settings);
  const validation = SettingsSchema.safeParse(draft);

  return {
    draft,
    update: setDraft,
    errors: validation.success ? {} : issuesByPath(validation.error),
    valid: validation.success,
    dirty: changedPaths(snapshot.settings, draft).length > 0,
    saving: mutation.isPending,
    save: () => {
      onNotice(null);
      mutation.mutate(
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
    },
    discard: () => {
      setDraft(snapshot.settings);
    },
  };
}
