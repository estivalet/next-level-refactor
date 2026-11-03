import type { ScrapeProvider } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { scrapeKey } from './providerText.ts';

export interface PickerOption {
  value: string;
  label: string;
}

/**
 * Links a system to the source's system when it has none yet: a ScreenScraper system
 * (NO_SCRAPER_SYSTEM) or a LaunchBox platform (NO_LAUNCHBOX_PLATFORM, FR-SCR-6).
 */
export function SystemPicker(props: {
  provider: ScrapeProvider;
  options: readonly PickerOption[];
  onSave: (value: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const key = (name: string) => scrapeKey(props.provider, name);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-slate-300">{t(key('needsSystem'))}</p>
      {props.options.length === 0 && <p className="text-slate-500">{t(key('noSystems'))}</p>}
      <div className="flex gap-2">
        <select
          aria-label={t(key('systemLabel'))}
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value);
          }}
          className={INPUT}
        >
          <option value="">{t(key('chooseSystem'))}</option>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${PRIMARY_BUTTON} shrink-0`}
          disabled={!choice || saving}
          onClick={() => {
            setSaving(true);
            void props.onSave(choice).finally(() => {
              setSaving(false);
            });
          }}
        >
          {t(key('saveSystem'))}
        </button>
        <button
          type="button"
          className={`${SECONDARY_BUTTON} shrink-0`}
          onClick={() => {
            void props.onReload();
          }}
        >
          {t('library.scrape.reloadSystems')}
        </button>
      </div>
    </div>
  );
}
