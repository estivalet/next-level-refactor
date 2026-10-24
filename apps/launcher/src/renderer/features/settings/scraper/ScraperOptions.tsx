import {
  GAME_ART_KINDS,
  SCRAPE_FIELDS,
  type ScraperSettings,
  type Settings,
} from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from '../form/useSettingsDraft.ts';
import { OrderedList } from '../themes/OrderedList.tsx';

/** ScreenScraper region codes offered in the priority list. */
const REGIONS = [
  'us',
  'eu',
  'wor',
  'jp',
  'ss',
  'fr',
  'de',
  'es',
  'it',
  'br',
  'kr',
  'au',
  'asia',
  'cn',
];
const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ja'];
/** Batch scrapes never touch the title (D19). */
const BATCH_FIELDS = SCRAPE_FIELDS.filter((field) => field !== 'title');

function withScraper(settings: Settings, patch: Partial<ScraperSettings>): Settings {
  return { ...settings, scraper: { ...settings.scraper, ...patch } };
}

/** Adds or removes `value`; the rest keep their order. */
function toggled<T extends string>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-white">{label}</span>
        {help && <p className="text-xs text-slate-400">{help}</p>}
      </div>
      {children}
    </div>
  );
}

/** Settings → Scraper → Scraping (FR-SCR-2): priorities and the batch defaults. */
export function ScraperOptions({
  draft,
  update,
  errors,
}: Pick<SettingsDraft, 'draft' | 'update' | 'errors'>) {
  const { t } = useTranslation();
  const scraper = draft.scraper;
  const regionsError = errors['scraper.regionPriority'];
  const kindLabel = (kind: string) =>
    t(`settings.themes.options.kinds.${kind}`, { defaultValue: kind });

  return (
    <section className="flex flex-col">
      <h3 className="pt-4 text-sm font-medium text-white">{t('settings.scraper.options')}</h3>
      <Row label={t('settings.scraper.regions')} help={t('settings.scraper.regionsHelp')}>
        <div className="flex flex-col gap-1">
          <OrderedList
            label={t('settings.scraper.regions')}
            items={scraper.regionPriority}
            options={REGIONS}
            onChange={(regionPriority) => {
              update((current) => withScraper(current, { regionPriority }));
            }}
          />
          {regionsError && <p className="text-xs text-[#ff8a80]">{t(regionsError)}</p>}
        </div>
      </Row>
      <Row label={t('settings.scraper.languages')} help={t('settings.scraper.languagesHelp')}>
        <OrderedList
          label={t('settings.scraper.languages')}
          items={scraper.languagePriority}
          options={LANGUAGES}
          onChange={(languagePriority) => {
            update((current) => withScraper(current, { languagePriority }));
          }}
        />
      </Row>
      <Row label={t('settings.scraper.artKinds')}>
        <fieldset
          aria-label={t('settings.scraper.artKinds')}
          className="grid w-72 grid-cols-2 gap-1"
        >
          {GAME_ART_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={scraper.artKinds.includes(kind)}
                onChange={() => {
                  update((current) =>
                    withScraper(current, {
                      artKinds: toggled(current.scraper.artKinds, kind),
                    }),
                  );
                }}
                className="accent-[#990033]"
              />
              {kindLabel(kind)}
            </label>
          ))}
        </fieldset>
      </Row>
      <Row label={t('settings.scraper.fields')}>
        <fieldset aria-label={t('settings.scraper.fields')} className="grid w-72 grid-cols-2 gap-1">
          {BATCH_FIELDS.map((field) => (
            <label key={field} className="flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={scraper.fields.includes(field)}
                onChange={() => {
                  update((current) =>
                    withScraper(current, {
                      fields: toggled(current.scraper.fields, field),
                    }),
                  );
                }}
                className="accent-[#990033]"
              />
              {t(`scrape.fields.${field}`)}
            </label>
          ))}
        </fieldset>
      </Row>
    </section>
  );
}
