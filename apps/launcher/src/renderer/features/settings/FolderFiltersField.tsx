import {
  FOLDER_FILTER_PREFIXES,
  FOLDER_FILTER_RENAMES_MAX,
  type FolderFilters,
  type Settings,
} from '@nextlevel/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from './form/useSettingsDraft.ts';

const BUTTON =
  'flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40';
const ICON_BUTTON =
  'rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';
const INPUT =
  'w-48 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
const BASE = 'storage.folderFilters';

const withFolderFilters = (
  settings: Settings,
  change: (current: FolderFilters) => FolderFilters,
): Settings => ({
  ...settings,
  storage: { ...settings.storage, folderFilters: change(settings.storage.folderFilters) },
});

/**
 * Settings → Storage → Folder filters (FR-LIB-18, US-C12): which folder prefixes become filters,
 * the filter of games in no such folder, and renames. Main applies a saved change from the
 * library's paths at once, so no rescan is offered.
 */
export function FolderFiltersField({
  draft,
  update,
  errors,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors'>) {
  const { t } = useTranslation();
  const legend = useId();
  const outsideId = useId();
  const value = draft.storage.folderFilters;
  const change = (next: (current: FolderFilters) => FolderFilters) => {
    update((current) => withFolderFilters(current, next));
  };
  const error = (path: string) => {
    const key = errors[`${BASE}.${path}`];
    return key ? <p className="text-xs text-[#ff8a80]">{t(key)}</p> : null;
  };
  const setRename = (index: number, field: 'folder' | 'filter', text: string) => {
    change((current) => ({
      ...current,
      renames: current.renames.map((entry, i) =>
        i === index ? { ...entry, [field]: text } : entry,
      ),
    }));
  };

  return (
    <fieldset aria-labelledby={legend} className="flex flex-col gap-3 border-t border-white/5 pt-4">
      <h3 id={legend} className="text-sm font-medium text-white">
        {t('settings.storage.folderFilters.title')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.storage.folderFilters.help')}</p>
      <div className="flex items-center gap-3 text-xs text-slate-200">
        <span>{t('settings.storage.folderFilters.prefixes')}</span>
        {FOLDER_FILTER_PREFIXES.map((prefix) => (
          <label key={prefix} className="flex items-center gap-1 font-mono">
            <input
              type="checkbox"
              checked={value.prefixes.includes(prefix)}
              onChange={(event) => {
                const on = event.target.checked;
                change((current) => ({
                  ...current,
                  prefixes: FOLDER_FILTER_PREFIXES.filter((p) =>
                    p === prefix ? on : current.prefixes.includes(p),
                  ),
                }));
              }}
              className="accent-emerald-500"
            />
            {prefix}
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={outsideId} className="text-xs text-slate-200">
          {t('settings.storage.folderFilters.outside')}
        </label>
        <input
          id={outsideId}
          type="text"
          value={value.outside}
          aria-invalid={errors[`${BASE}.outside`] ? true : undefined}
          onChange={(event) => {
            const outside = event.target.value;
            change((current) => ({ ...current, outside }));
          }}
          className={INPUT}
        />
        <p className="text-[11px] text-slate-500">
          {t('settings.storage.folderFilters.outsideHelp')}
        </p>
        {error('outside')}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-200">{t('settings.storage.folderFilters.renames')}</p>
        <p className="text-[11px] text-slate-500">
          {t('settings.storage.folderFilters.renamesHelp')}
        </p>
        <ol className="flex flex-col gap-2">
          {value.renames.map((entry, index) => {
            const n = index + 1;
            return (
              // Renames have no id: the position is their identity while editing.
              <li key={index} className="flex items-start gap-2">
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={entry.folder}
                    placeholder={t('settings.storage.folderFilters.folder')}
                    aria-label={t('settings.storage.folderFilters.folderLabel', { n })}
                    onChange={(event) => {
                      setRename(index, 'folder', event.target.value);
                    }}
                    className={INPUT}
                  />
                  {error(`renames.${String(index)}.folder`)}
                </div>
                <span aria-hidden="true" className="mt-1.5 text-slate-500">
                  →
                </span>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={entry.filter}
                    placeholder={t('settings.storage.folderFilters.filter')}
                    aria-label={t('settings.storage.folderFilters.filterLabel', { n })}
                    onChange={(event) => {
                      setRename(index, 'filter', event.target.value);
                    }}
                    className={INPUT}
                  />
                  {error(`renames.${String(index)}.filter`)}
                </div>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={t('settings.storage.folderFilters.remove', { n })}
                  onClick={() => {
                    change((current) => ({
                      ...current,
                      renames: current.renames.filter((_, i) => i !== index),
                    }));
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
          className={BUTTON}
          disabled={value.renames.length >= FOLDER_FILTER_RENAMES_MAX}
          onClick={() => {
            change((current) => ({
              ...current,
              renames: [...current.renames, { folder: '', filter: '' }],
            }));
          }}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t('settings.storage.folderFilters.add')}
        </button>
      </div>
    </fieldset>
  );
}
