import { customSystemId } from '@nextlevel/shared';
import { withCustomSystems } from '@nextlevel/system-catalog';
import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusRequest, type FocusRequest } from '../focusRequest.ts';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { useShippedSystems } from '../settingsApi.ts';
import { CustomSystemEditor } from './CustomSystemEditor.tsx';
import {
  withCustomSystemPatch,
  withNewCustomSystem,
  withoutCustomSystem,
} from './customSystemsDraft.ts';
import { filterSystems, withSystem } from './filterSystems.ts';
import { SystemEditor } from './SystemEditor.tsx';
import { NewSystemForm } from './NewSystemForm.tsx';
import { SystemList } from './SystemList.tsx';

/**
 * Settings → Systems (FR-EMU-1, FR-LIB-2, FR-EMU-11): enable systems, override folder/extensions,
 * and add, edit or delete the user's own systems.
 * `focus` opens that system's editor (US-C2: "Fix in Settings").
 */
export function SystemsSection({ focus }: { focus?: FocusRequest }) {
  const { t } = useTranslation();
  const shipped = useShippedSystems();
  const [query, setQuery] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(focus?.id ?? null);
  const [adding, setAdding] = useState(false);
  useFocusRequest(focus, setEditingId);
  const container = useRef<HTMLDivElement>(null);

  return (
    <SettingsSection>
      {({ draft, update, errors }) => {
        // Unsaved custom systems show too: they are part of the draft.
        const systems = withCustomSystems(shipped.data ?? [], draft.customSystems);
        const customIndex = draft.customSystems.findIndex((s) => s.id === editingId);
        const custom = draft.customSystems[customIndex];
        const shown = filterSystems(systems, query, draft.systems, enabledOnly ? 'enabled' : 'all');
        const enabledCount = systems.filter((s) => draft.systems[s.id]?.enabled === true).length;
        const editing = systems.find((s) => s.id === editingId);
        // An editor with invalid values stays open: closing it would hide the only error message
        // while Save stays disabled.
        const editingHasErrors =
          editingId !== null &&
          Object.keys(errors).some(
            (path) =>
              path.startsWith(`systems.${editingId}.`) ||
              (customIndex >= 0 && path.startsWith(`customSystems.${String(customIndex)}.`)),
          );
        const openEditor = (id: string) => {
          if (!editingHasErrors) {
            setAdding(false);
            setEditingId(id);
          }
        };
        const addSystem = (input: { name: string; extensions: string[] }) => {
          const taken = systems.map((s) => s.id);
          update((current) => withNewCustomSystem(current, input, taken).settings);
          setAdding(false);
          setQuery('');
          setEditingId(customSystemId(input.name, taken));
        };
        const closeEditor = () => {
          if (editingHasErrors || !editing) return;
          flushSync(() => {
            setEditingId(null);
          });
          // Back to the row the editor was opened from (NFR-A11Y-1).
          container.current
            ?.querySelector<HTMLButtonElement>(
              `[data-system-id="${CSS.escape(editing.id)}"] [data-action="edit"]`,
            )
            ?.focus();
        };

        return (
          <div ref={container} className="flex flex-col gap-3 py-4">
            <p className="text-sm text-slate-300">{t('settings.systems.intro')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={query}
                aria-label={t('settings.systems.search')}
                placeholder={t('settings.systems.search')}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                className="w-64 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              />
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={enabledOnly}
                  onChange={(event) => {
                    setEnabledOnly(event.target.checked);
                  }}
                />
                {t('settings.systems.enabledOnly')}
              </label>
              <span role="status" className="ml-auto text-xs text-slate-300">
                {t('settings.systems.count', { enabled: enabledCount, total: systems.length })}
              </span>
              <button
                type="button"
                disabled={editingHasErrors}
                onClick={() => {
                  setEditingId(null);
                  setAdding(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                {t('settings.systems.custom.addButton')}
              </button>
            </div>
            {adding && (
              <NewSystemForm
                takenNames={new Set(systems.map((s) => s.name.toLowerCase()))}
                onAdd={addSystem}
                onCancel={() => {
                  setAdding(false);
                }}
              />
            )}
            {custom && (
              <CustomSystemEditor
                key={custom.id}
                system={custom}
                index={customIndex}
                settings={draft.systems[custom.id]}
                profiles={draft.profiles.filter((p) => p.systems.includes(custom.id))}
                errors={errors}
                onChange={(patch) => {
                  update((current) => withCustomSystemPatch(current, custom.id, patch));
                }}
                onProfileChange={(defaultProfileId) => {
                  update((current) => withSystem(current, custom.id, { defaultProfileId }));
                }}
                onDelete={() => {
                  update((current) => withoutCustomSystem(current, custom.id));
                  setEditingId(null);
                }}
                onClose={closeEditor}
              />
            )}
            {editing && !custom && (
              <SystemEditor
                key={editing.id}
                system={editing}
                settings={draft.systems[editing.id]}
                profiles={draft.profiles.filter((p) => p.systems.includes(editing.id))}
                errors={errors}
                onChange={(patch) => {
                  update((current) => withSystem(current, editing.id, patch));
                }}
                onReset={() => {
                  update((current) =>
                    withSystem(current, editing.id, {
                      folderName: undefined,
                      extensions: undefined,
                      screenscraperId: undefined,
                      launchboxPlatform: undefined,
                    }),
                  );
                }}
                onClose={closeEditor}
              />
            )}
            <SystemList
              systems={shown}
              settings={draft.systems}
              onToggle={(id, enabled) => {
                update((current) => withSystem(current, id, { enabled }));
              }}
              onEdit={openEditor}
            />
          </div>
        );
      }}
    </SettingsSection>
  );
}
