import { orderedLocations, type Settings, type StorageLocation } from '@nextlevel/shared';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { v7 as uuidv7 } from 'uuid';
import { ScanPanel } from '../library/ScanPanel.tsx';
import { ArtFoldersFields } from './ArtFoldersFields.tsx';
import { SettingsSection } from './form/SettingsSection.tsx';
import { MediaLocationField } from './MediaLocationField.tsx';
import { usePickFolder } from './settingsApi.ts';

const ICON_BUTTON =
  'rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-30';

/** The last folder name in a path: "F:\Games\Retro" → "Retro". */
function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function withLocations(settings: Settings, locations: StorageLocation[]): Settings {
  return { ...settings, storage: { ...settings.storage, locations: orderedLocations(locations) } };
}

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Settings → Storage (FR-LIB-1): base folders searched in priority order. */
export function StorageSection() {
  const { t } = useTranslation();
  const pickFolder = usePickFolder();
  const container = useRef<HTMLDivElement>(null);

  // Keyboard focus survives reordering and removal (NFR-A11Y-1). flushSync applies the draft
  // change to the DOM first, so the element to focus already exists.
  const focusAfterMove = (id: string, action: 'up' | 'down') => {
    const row = container.current?.querySelector(`li[data-location-id="${CSS.escape(id)}"]`);
    const same = row?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    const other = row?.querySelector<HTMLButtonElement>(
      `[data-action="${action === 'up' ? 'down' : 'up'}"]`,
    );
    (same && !same.disabled ? same : other)?.focus();
  };
  const focusAfterRemove = (index: number) => {
    const names = container.current?.querySelectorAll<HTMLInputElement>('li input') ?? [];
    const next = names[index] ?? names[index - 1];
    (next ?? container.current?.querySelector<HTMLButtonElement>('[data-action="add"]'))?.focus();
  };

  return (
    <SettingsSection>
      {({ draft, update, errors, dirty }) => {
        const locations = draft.storage.locations;
        const set = (next: StorageLocation[]) => {
          update((current) => withLocations(current, next));
        };
        const add = () => {
          pickFolder.mutate(t('settings.storage.pickTitle'), {
            onSuccess: (path) => {
              if (!path) return;
              const location = { id: uuidv7(), name: folderName(path), path, priority: 0 };
              update((current) => withLocations(current, [...current.storage.locations, location]));
            },
          });
        };

        return (
          <div ref={container} className="flex flex-col gap-4 py-4">
            <p className="text-sm text-slate-300">{t('settings.storage.intro')}</p>
            {locations.length === 0 && (
              <p className="text-sm text-slate-400">{t('settings.storage.empty')}</p>
            )}
            <ol className="flex flex-col gap-2">
              {locations.map((location, index) => {
                const base = `storage.locations.${String(index)}`;
                const nameError = errors[`${base}.name`];
                const pathError = errors[`${base}.path`];
                const label = location.name || String(index + 1);
                return (
                  <li
                    key={location.id}
                    data-location-id={location.id}
                    className="flex items-start gap-3 rounded-lg border border-white/10 p-3"
                  >
                    <span className="mt-1.5 w-5 text-center text-xs text-slate-400">
                      {t('settings.storage.priority', { n: index + 1 })}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        type="text"
                        value={location.name}
                        aria-label={t('settings.storage.name', { n: index + 1 })}
                        aria-invalid={nameError ? true : undefined}
                        onChange={(event) => {
                          set(
                            locations.map((l) =>
                              l.id === location.id ? { ...l, name: event.target.value } : l,
                            ),
                          );
                        }}
                        className="w-48 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                      />
                      {nameError && <p className="text-xs text-[#ff8a80]">{t(nameError)}</p>}
                      <code className="text-xs break-all text-slate-300 select-text">
                        {location.path}
                      </code>
                      {pathError && <p className="text-xs text-[#ff8a80]">{t(pathError)}</p>}
                    </div>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      data-action="up"
                      disabled={index === 0}
                      aria-label={t('settings.storage.moveUp', { name: label })}
                      onClick={() => {
                        flushSync(() => {
                          set(move(locations, index, index - 1));
                        });
                        focusAfterMove(location.id, 'up');
                      }}
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      data-action="down"
                      disabled={index === locations.length - 1}
                      aria-label={t('settings.storage.moveDown', { name: label })}
                      onClick={() => {
                        flushSync(() => {
                          set(move(locations, index, index + 1));
                        });
                        focusAfterMove(location.id, 'down');
                      }}
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={t('settings.storage.remove', { name: label })}
                      onClick={() => {
                        flushSync(() => {
                          set(locations.filter((l) => l.id !== location.id));
                        });
                        focusAfterRemove(index);
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              data-action="add"
              onClick={add}
              disabled={pickFolder.isPending}
              className="flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t('settings.storage.add')}
            </button>
            <ScanPanel dirty={dirty} hasLocations={locations.length > 0} />
            <MediaLocationField draft={draft} update={update} errors={errors} dirty={dirty} />
            <ArtFoldersFields draft={draft} update={update} errors={errors} />
          </div>
        );
      }}
    </SettingsSection>
  );
}
