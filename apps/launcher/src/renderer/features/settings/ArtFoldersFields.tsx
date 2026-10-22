import type { Settings } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from './form/useSettingsDraft.ts';
import { usePickFolder } from './settingsApi.ts';

type FolderKey = 'assetsPath' | 'themesPath';

const BUTTON =
  'rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40';

function withFolder(settings: Settings, key: FolderKey, path: string | null): Settings {
  return { ...settings, storage: { ...settings.storage, [key]: path } };
}

/** Settings → Storage → Art: the shared art folder and the theme packs folder (FR-THM-2). */
export function ArtFoldersFields({
  draft,
  update,
  errors,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors'>) {
  const { t } = useTranslation();
  const pickFolder = usePickFolder();

  return (
    <section className="flex flex-col gap-3 border-t border-white/5 pt-4">
      <h3 className="text-sm font-medium text-white">{t('settings.storage.art.title')}</h3>
      {(['assetsPath', 'themesPath'] as const).map((key) => {
        const path = draft.storage[key];
        const error = errors[`storage.${key}`];
        return (
          <fieldset key={key} className="flex flex-col gap-1">
            <legend className="text-xs text-slate-300">{t(`settings.storage.art.${key}`)}</legend>
            <p className="text-xs text-slate-400">{t(`settings.storage.art.${key}Help`)}</p>
            <div className="flex items-center gap-2">
              {path ? (
                <code className="text-xs break-all text-slate-200 select-text">{path}</code>
              ) : (
                <span className="text-xs text-slate-400">{t('settings.storage.art.notSet')}</span>
              )}
              <button
                type="button"
                className={BUTTON}
                disabled={pickFolder.isPending}
                onClick={() => {
                  pickFolder.mutate(t(`settings.storage.art.${key}`), {
                    onSuccess: (picked) => {
                      if (picked) update((current) => withFolder(current, key, picked));
                    },
                  });
                }}
              >
                {t('settings.storage.art.browse')}
              </button>
              {path && (
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => {
                    update((current) => withFolder(current, key, null));
                  }}
                >
                  {t('settings.storage.art.clear')}
                </button>
              )}
            </div>
            {error && <p className="text-xs text-[#ff8a80]">{t(error)}</p>}
          </fieldset>
        );
      })}
    </section>
  );
}
