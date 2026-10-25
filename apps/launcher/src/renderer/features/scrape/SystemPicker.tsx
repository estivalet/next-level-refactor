import type { ScraperSystem } from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';

/** Links a system to a ScreenScraper system when it has no id yet (NO_SCRAPER_SYSTEM). */
export function SystemPicker(props: {
  systems: readonly ScraperSystem[];
  onSave: (screenscraperId: number) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="text-slate-300">{t('library.scrape.needsSystem')}</p>
      {props.systems.length === 0 && (
        <p className="text-slate-500">{t('library.scrape.noSystems')}</p>
      )}
      <div className="flex gap-2">
        <select
          aria-label={t('library.scrape.systemLabel')}
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value);
          }}
          className={INPUT}
        >
          <option value="">{t('library.scrape.chooseSystem')}</option>
          {props.systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${PRIMARY_BUTTON} shrink-0`}
          disabled={!choice || saving}
          onClick={() => {
            setSaving(true);
            void props.onSave(Number(choice)).finally(() => {
              setSaving(false);
            });
          }}
        >
          {t('library.scrape.saveSystem')}
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
