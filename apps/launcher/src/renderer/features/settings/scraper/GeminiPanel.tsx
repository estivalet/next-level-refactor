import { ERROR_CODES } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settingsApi.ts';
import { useGeminiKeyActions, useGeminiKeyStatus } from './geminiApi.ts';

const INPUT =
  'w-64 rounded-md border border-white/25 bg-white/[0.07] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 hover:border-white/40 focus-visible:border-white/60 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
const BUTTON =
  'rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
export const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

/**
 * Settings → Scraper → Gemini (FR-SCR-7): the API key goes straight to the OS secret store and is
 * never shown again, like the ScreenScraper credentials.
 */
export function GeminiPanel() {
  const { t } = useTranslation();
  const id = useId();
  const status = useGeminiKeyStatus();
  const { set, test } = useGeminiKeyActions();
  const [value, setValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const typed = value.trim();
  const available = status.data?.available ?? false;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 border-b border-white/5 py-4"
    >
      <h3 id={`${id}-title`} className="text-sm font-medium text-white">
        {t('settings.scraper.gemini.title')}
      </h3>
      <p className="text-xs text-slate-400">
        {t('settings.scraper.gemini.helpBefore')}{' '}
        <a
          href={AI_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-slate-200 underline hover:text-white"
        >
          {t('settings.scraper.gemini.helpLink')}
        </a>{' '}
        {t('settings.scraper.gemini.helpAfter')}
      </p>
      {status.data && !available && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(ERROR_CODES.SECRETS_UNAVAILABLE)}
        </p>
      )}
      {status.data && !status.data.set && (
        <p className="text-xs text-slate-300">{t('settings.scraper.gemini.notSet')}</p>
      )}
      <label className="flex items-center gap-3 text-xs text-slate-200">
        <span className="w-36 shrink-0">{t('settings.scraper.gemini.apiKey')}</span>
        <input
          type="password"
          autoComplete="off"
          value={value}
          placeholder={status.data?.set ? t('settings.scraper.saved') : ''}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          className={INPUT}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!available || typed === '' || set.isPending}
          onClick={() => {
            setNotice(null);
            set.mutate(typed, {
              onSuccess: () => {
                setValue('');
                setNotice('settings.scraper.savedNotice');
              },
            });
          }}
          className={BUTTON}
        >
          {t('settings.scraper.gemini.saveKey')}
        </button>
        <button
          type="button"
          disabled={test.isPending || set.isPending}
          onClick={() => {
            setNotice(null);
            test.mutate();
          }}
          className={BUTTON}
        >
          {test.isPending ? t('settings.scraper.testing') : t('settings.scraper.gemini.test')}
        </button>
        {status.data?.set && (
          <button
            type="button"
            disabled={!available || set.isPending}
            onClick={() => {
              setNotice(null);
              set.mutate(null, {
                onSuccess: () => {
                  setNotice('settings.scraper.removed');
                },
              });
            }}
            className={BUTTON}
          >
            {t('settings.scraper.gemini.removeKey')}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-xs text-slate-200">
          {t(notice)}
        </p>
      )}
      {(set.isError || test.isError) && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(errorMessageKey(set.error ?? test.error))}
        </p>
      )}
      {test.isSuccess && (
        <p role="status" className="text-xs text-slate-200">
          {t('settings.scraper.gemini.testOk')}
        </p>
      )}
    </section>
  );
}
