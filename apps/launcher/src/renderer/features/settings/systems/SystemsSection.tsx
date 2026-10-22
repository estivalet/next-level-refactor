import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusRequest, type FocusRequest } from '../focusRequest.ts';
import { SettingsSection } from '../form/SettingsSection.tsx';
import { useSystemCatalog } from '../settingsApi.ts';
import { filterSystems, withSystem } from './filterSystems.ts';
import { SystemEditor } from './SystemEditor.tsx';
import { SystemList } from './SystemList.tsx';

/**
 * Settings → Systems (FR-EMU-1, FR-LIB-2): enable systems and override folder/extensions.
 * `focus` opens that system's editor (US-C2: "Fix in Settings").
 */
export function SystemsSection({ focus }: { focus?: FocusRequest }) {
  const { t } = useTranslation();
  const catalog = useSystemCatalog();
  const [query, setQuery] = useState('');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(focus?.id ?? null);
  useFocusRequest(focus, setEditingId);
  const systems = catalog.data ?? [];
  const container = useRef<HTMLDivElement>(null);

  return (
    <SettingsSection>
      {({ draft, update, errors }) => {
        const shown = filterSystems(systems, query, draft.systems, enabledOnly ? 'enabled' : 'all');
        const enabledCount = systems.filter((s) => draft.systems[s.id]?.enabled === true).length;
        const editing = systems.find((s) => s.id === editingId);
        // An editor with invalid values stays open: closing it would hide the only error message
        // while Save stays disabled.
        const editingHasErrors =
          editingId !== null &&
          Object.keys(errors).some((path) => path.startsWith(`systems.${editingId}.`));
        const openEditor = (id: string) => {
          if (!editingHasErrors) setEditingId(id);
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
            </div>
            {editing && (
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
