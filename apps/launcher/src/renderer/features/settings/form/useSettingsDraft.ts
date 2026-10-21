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
import { rebase } from './rebase.ts';

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
 * schema. Saving sends the base revision; a CONFLICT reloads the settings. Whenever a newer
 * snapshot arrives (own save, reload, a change made by main), the draft is rebased onto it, so
 * unsaved edits survive.
 */
export function useSettingsDraft(
  snapshot: SettingsSnapshot,
  { onSaved, onNotice }: { onSaved: () => void; onNotice: (key: string | null) => void },
): SettingsDraft {
  const client = useQueryClient();
  const mutation = useSaveSettings();
  const [state, setState] = useState({ base: snapshot, draft: snapshot.settings });
  let { draft } = state;
  if (state.base.revision !== snapshot.revision) {
    // The schema validates the merged draft below, like any other edit.
    draft = rebase(state.base.settings, state.draft, snapshot.settings) as Settings;
    setState({ base: snapshot, draft });
  }
  const setDraft = (change: Settings | ((settings: Settings) => Settings)) => {
    setState((current) => ({
      ...current,
      draft: typeof change === 'function' ? change(current.draft) : change,
    }));
  };
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
