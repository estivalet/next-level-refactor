import type { MediaLocation, Settings } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScanStatus, useStartScan } from '../library/scanApi.ts';
import type { SettingsDraft } from './form/useSettingsDraft.ts';
import { usePickFolder } from './settingsApi.ts';

const BUTTON =
  'rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40';

const withMedia = (settings: Settings, media: MediaLocation): Settings => ({
  ...settings,
  storage: { ...settings.storage, media },
});

/**
 * Settings → Storage → where scraped art goes (FR-SCR-4): beside the ROMs
 * (`<system folder>/media/<kind>/`) or one central folder (`<central>/<system id>/<kind>/`).
 * Changing it asks for a rescan: art already indexed stays where the last scan found it.
 */
export function MediaLocationField({
  draft,
  update,
  errors,
  dirty,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors' | 'dirty'>) {
  const { t } = useTranslation();
  const legend = useId();
  const pickFolder = usePickFolder();
  const scanStatus = useScanStatus();
  const startScan = useStartScan();
  const media = draft.storage.media;
  // What the page opened with: a change from it (saved or not) needs a rescan.
  const [opened] = useState(() => JSON.stringify(media));
  const changed = JSON.stringify(media) !== opened;
  const pick = () => {
    pickFolder.mutate(t('settings.storage.media.central'), {
      onSuccess: (path) => {
        if (path) update((current) => withMedia(current, { mode: 'central', path }));
      },
    });
  };
  const error = errors['storage.media.path'];

  return (
    <fieldset aria-labelledby={legend} className="flex flex-col gap-2 border-t border-white/5 pt-4">
      <h3 id={legend} className="text-sm font-medium text-white">
        {t('settings.storage.media.title')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.storage.media.help')}</p>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input
          type="radio"
          name={legend}
          checked={media.mode === 'perRomFolder'}
          onChange={() => {
            update((current) => withMedia(current, { mode: 'perRomFolder' }));
          }}
          className="accent-emerald-500"
        />
        {t('settings.storage.media.perRomFolder')}
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input
          type="radio"
          name={legend}
          checked={media.mode === 'central'}
          onChange={pick}
          className="accent-emerald-500"
        />
        {t('settings.storage.media.central')}
      </label>
      {media.mode === 'central' && (
        <div className="ml-6 flex items-center gap-2">
          <code className="text-xs break-all text-slate-200 select-text">{media.path}</code>
          <button type="button" className={BUTTON} disabled={pickFolder.isPending} onClick={pick}>
            {t('settings.storage.art.browse')}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-[#ff8a80]">{t(error)}</p>}
      {changed && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-amber-200">{t('settings.storage.media.rescan')}</p>
          <button
            type="button"
            className={BUTTON}
            disabled={dirty || startScan.isPending || scanStatus.data?.running === true}
            onClick={() => {
              startScan.mutate(undefined);
            }}
          >
            {t('settings.storage.media.scanAll')}
          </button>
        </div>
      )}
    </fieldset>
  );
}
