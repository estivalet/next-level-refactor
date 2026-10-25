import {
  BatchFieldSchema,
  GAME_ART_KINDS,
  type BatchField,
  type BatchScope,
  type GameArtKind,
  type ScraperSettings,
} from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { REGIONS } from '../settings/scraper/ScraperOptions.tsx';
import { errorMessageKey, useSettings } from '../settings/settingsApi.ts';
import { OrderedList } from '../settings/themes/OrderedList.tsx';
import { useStartBatch } from './batchApi.ts';

const BATCH_FIELDS = BatchFieldSchema.options;

const toggled = <T extends string>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

interface BatchRulesDialogProps {
  scope: BatchScope;
  /** What is scraped: a system name or "3 selected games". */
  title: string;
  onClose: () => void;
}

/** The batch rules (S7, US-C6, D18), from the Settings → Scraper defaults. */
export function BatchRulesDialog(props: BatchRulesDialogProps) {
  const settings = useSettings();
  const loaded = settings.data?.kind === 'ok' ? settings.data.snapshot.settings.scraper : null;
  return loaded ? <RulesForm {...props} defaults={loaded} /> : null;
}

function RulesForm({
  scope,
  title,
  onClose,
  defaults,
}: BatchRulesDialogProps & { defaults: ScraperSettings }) {
  const { t } = useTranslation();
  const start = useStartBatch();
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [kinds, setKinds] = useState<GameArtKind[]>(defaults.artKinds);
  const [fields, setFields] = useState<BatchField[]>(
    defaults.fields.filter((field): field is BatchField => field !== 'title'),
  );
  const [regions, setRegions] = useState<string[]>(defaults.regionPriority);
  const nothing = kinds.length === 0 && fields.length === 0;
  const box = (label: string, checked: boolean, onChange: () => void) => (
    <label key={label} className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="accent-emerald-500"
      />
      {label}
    </label>
  );

  return (
    <Modal
      title={t('library.batch.rulesTitle', { title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.batch.close')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={nothing || regions.length === 0 || start.isPending}
            onClick={() => {
              start.mutate(
                {
                  scope,
                  rules: {
                    onlyMissing,
                    kinds: GAME_ART_KINDS.filter((kind) => kinds.includes(kind)),
                    fields: BATCH_FIELDS.filter((field) => fields.includes(field)),
                    regions,
                  },
                },
                { onSuccess: onClose },
              );
            }}
          >
            {t('library.batch.start')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {box(t('library.batch.onlyMissing'), onlyMissing, () => {
          setOnlyMissing(!onlyMissing);
        })}
        <p className="text-[11px] text-slate-500">{t('library.batch.rulesHelp')}</p>
        <fieldset className="grid grid-cols-2 gap-1">
          <legend className="mb-1 text-[11px] text-slate-400">{t('library.scrape.art')}</legend>
          {GAME_ART_KINDS.map((kind) =>
            box(t(`settings.themes.options.kinds.${kind}`), kinds.includes(kind), () => {
              setKinds(toggled(kinds, kind));
            }),
          )}
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-1">
          <legend className="mb-1 text-[11px] text-slate-400">
            {t('library.scrape.metadata')}
          </legend>
          {BATCH_FIELDS.map((field) =>
            box(t(`library.fields.${field}`), fields.includes(field), () => {
              setFields(toggled(fields, field));
            }),
          )}
        </fieldset>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-400">{t('settings.scraper.regions')}</span>
          <OrderedList
            label={t('settings.scraper.regions')}
            items={regions}
            options={REGIONS}
            onChange={setRegions}
          />
        </div>
        {start.isError && (
          <p role="alert" className="text-xs text-red-300">
            {t(errorMessageKey(start.error))}
          </p>
        )}
      </div>
    </Modal>
  );
}
