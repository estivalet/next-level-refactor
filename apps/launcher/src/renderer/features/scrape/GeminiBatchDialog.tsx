import {
  GEMINI_FIELDS,
  type BatchScope,
  type GeminiBatchRules,
  type GeminiField,
} from '@nextlevel/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../library/Modal.tsx';
import { useGeminiKeyStatus } from '../settings/scraper/geminiApi.ts';
import { errorMessageKey, useSettings } from '../settings/settingsApi.ts';
import { useOpenApp } from '../shell/useOpenApp.ts';
import { useStartGeminiBatch } from './batchApi.ts';

const toggled = <T extends string>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

interface GeminiBatchDialogProps {
  scope: BatchScope;
  /** A system name or "3 selected games". */
  title: string;
  onClose: () => void;
}

/** Fill details with Gemini as a batch (FR-SCR-7, spec §7): fields, Review / Auto-update, route. */
export function GeminiBatchDialog({ scope, title, onClose }: GeminiBatchDialogProps) {
  const { t } = useTranslation();
  const openApp = useOpenApp();
  const settings = useSettings();
  const key = useGeminiKeyStatus();
  const start = useStartGeminiBatch();
  const [fields, setFields] = useState<GeminiField[]>([...GEMINI_FIELDS]);
  const [mode, setMode] = useState<GeminiBatchRules['mode']>('review');
  const [route, setRoute] = useState<GeminiBatchRules['route']>('api');
  const tool =
    settings.data?.kind === 'ok' ? settings.data.snapshot.settings.scraper.gemini.webTool : null;
  const toolReady = tool !== null && tool.python !== '' && tool.firefoxProfile !== '';
  const keyMissing = key.data !== undefined && !key.data.set;
  const blocker =
    route === 'web' && !toolReady
      ? 'library.geminiBatch.webSetup'
      : route === 'api' && keyMissing
        ? 'errors.geminiNoKey'
        : null;
  const ordered = GEMINI_FIELDS.filter((field) => fields.includes(field));
  const radio = <T extends string>(
    name: string,
    value: T,
    current: T,
    set: (value: T) => void,
    label: string,
  ) => (
    <label className="flex items-center gap-2 text-xs text-slate-300">
      <input
        type="radio"
        name={name}
        aria-label={label}
        checked={current === value}
        onChange={() => {
          set(value);
        }}
        className="accent-emerald-500"
      />
      {label}
    </label>
  );

  return (
    <Modal
      title={t('library.geminiBatch.rulesTitle', { title })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            {t('library.geminiBatch.close')}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={blocker !== null || ordered.length === 0 || start.isPending}
            onClick={() => {
              start.mutate(
                { scope, rules: { fields: ordered, mode, route } },
                { onSuccess: onClose },
              );
            }}
          >
            {t('library.geminiBatch.start')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-slate-400">{t('library.geminiBatch.help')}</p>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs text-slate-500">{t('library.geminiBatch.fields')}</legend>
          <div className="grid grid-cols-2 gap-1">
            {GEMINI_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  aria-label={t(`scrape.fields.${field}`)}
                  checked={fields.includes(field)}
                  onChange={() => {
                    setFields((current) => toggled(current, field));
                  }}
                  className="accent-emerald-500"
                />
                {t(`scrape.fields.${field}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs text-slate-500">{t('library.geminiBatch.mode')}</legend>
          {radio('gemini-mode', 'review', mode, setMode, t('library.geminiBatch.review'))}
          {radio('gemini-mode', 'auto', mode, setMode, t('library.geminiBatch.auto'))}
          <p className="text-xs text-slate-400">
            {t(mode === 'auto' ? 'library.geminiBatch.autoHelp' : 'library.geminiBatch.reviewHelp')}
          </p>
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="pb-1 text-xs text-slate-500">{t('library.geminiBatch.route')}</legend>
          {radio('gemini-route', 'api', route, setRoute, t('library.geminiBatch.api'))}
          {radio('gemini-route', 'web', route, setRoute, t('library.geminiBatch.web'))}
          {route === 'web' && (
            <p className="text-xs text-slate-400">{t('library.geminiBatch.webHelp')}</p>
          )}
        </fieldset>
        {blocker && (
          <div className="flex items-center gap-3 text-xs text-amber-200">
            <p className="flex-1">{t(blocker)}</p>
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                openApp('settings', { section: 'scraper' });
              }}
            >
              {t('library.geminiBatch.openSettings')}
            </button>
          </div>
        )}
        {start.isError && (
          <p role="alert" className="text-xs text-red-300">
            {t(errorMessageKey(start.error))}
          </p>
        )}
      </div>
    </Modal>
  );
}
