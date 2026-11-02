import { ERROR_CODES, type CredentialStatus } from '@nextlevel/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessageKey } from '../settingsApi.ts';
import { RemoveCredentials } from './RemoveCredentials.tsx';
import { useSetCredentials, useTestCredentials } from './scraperApi.ts';

type Field = 'user' | 'password' | 'devId' | 'devPassword';

const EMPTY: Record<Field, string> = { user: '', password: '', devId: '', devPassword: '' };

const INPUT =
  'w-64 rounded-md border border-white/25 bg-white/[0.07] px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 hover:border-white/40 focus-visible:border-white/60 focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
const BUTTON =
  'rounded-md bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';

/**
 * Settings → Scraper → account (FR-SCR-3, US-D6, D15): what is typed goes straight to the OS
 * credential store; stored values are never shown again, only "Saved". Empty = unchanged.
 */
export function CredentialsFields({ status }: { status: CredentialStatus }) {
  const { t } = useTranslation();
  const id = useId();
  const [values, setValues] = useState(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSetCredentials();
  const test = useTestCredentials();
  // Pasted values often carry a stray space or newline; ScreenScraper would reject them.
  const typed = Object.entries(values)
    .map(([field, value]) => [field, value.trim()] as const)
    .filter(([, value]) => value !== '');
  const devMissing = !status.devId || !status.devPassword;
  const saveTyped = (then?: () => void) => {
    setNotice(null);
    save.mutate(Object.fromEntries(typed), {
      onSuccess: () => {
        setValues(EMPTY);
        setNotice('settings.scraper.savedNotice');
        then?.();
      },
    });
  };

  const input = (field: Field, secret: boolean) => (
    <label className="flex items-center gap-3 text-xs text-slate-200">
      <span className="w-36 shrink-0">{t(`settings.scraper.${field}`)}</span>
      <input
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        value={values[field]}
        placeholder={status[field] ? t('settings.scraper.saved') : ''}
        onChange={(event) => {
          setValues((current) => ({ ...current, [field]: event.target.value }));
        }}
        className={INPUT}
      />
    </label>
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 border-b border-white/5 py-4"
    >
      <h3 id={`${id}-title`} className="text-sm font-medium text-white">
        {t('settings.scraper.account')}
      </h3>
      <p className="text-xs text-slate-400">{t('settings.scraper.accountHelp')}</p>
      {!status.available && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(ERROR_CODES.SECRETS_UNAVAILABLE)}
        </p>
      )}
      {input('user', false)}
      {input('password', true)}
      <details className="flex flex-col gap-2">
        <summary className="cursor-pointer text-xs text-slate-200">
          {t('settings.scraper.developer')}
          {devMissing && (
            <span className="ml-2 rounded bg-[#990033]/40 px-1.5 py-0.5 text-[10px] text-white">
              {t('settings.scraper.required')}
            </span>
          )}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-slate-400">{t('settings.scraper.developerHelp')}</p>
          {input('devId', false)}
          {input('devPassword', true)}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!status.available || typed.length === 0 || save.isPending}
          onClick={() => {
            saveTyped();
          }}
          className={BUTTON}
        >
          {t('settings.scraper.saveCredentials')}
        </button>
        <button
          type="button"
          disabled={test.isPending || save.isPending}
          onClick={() => {
            // Test what is on screen: typed values are saved first, else Test would check the
            // previously stored ones (or none) while the fields look filled in.
            if (typed.length > 0 && status.available) {
              saveTyped(() => {
                test.mutate();
              });
            } else {
              test.mutate();
            }
          }}
          className={BUTTON}
        >
          {test.isPending ? t('settings.scraper.testing') : t('settings.scraper.test')}
        </button>
        <RemoveCredentials
          disabled={!status.available || save.isPending}
          onRemove={() => {
            setNotice(null);
            save.mutate(
              { devId: null, devPassword: null, user: null, password: null },
              {
                onSuccess: () => {
                  setValues(EMPTY);
                  setNotice('settings.scraper.removed');
                },
              },
            );
          }}
        />
      </div>
      {notice && (
        <p role="status" className="text-xs text-slate-200">
          {t(notice)}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {t(errorMessageKey(save.error))}
        </p>
      )}
      <TestResult test={test} />
    </section>
  );
}

function TestResult({ test }: { test: ReturnType<typeof useTestCredentials> }) {
  const { t } = useTranslation();
  if (test.isError) {
    return (
      <p role="alert" className="text-xs text-[#ff8a80]">
        {t(errorMessageKey(test.error))}
      </p>
    );
  }
  if (!test.data) return null;
  const unknown = t('settings.scraper.unknownCount');
  const counts = {
    today: test.data.requestsToday ?? unknown,
    max: test.data.maxRequestsPerDay ?? unknown,
  };
  return (
    <p role="status" className="text-xs text-slate-200">
      {test.data.user
        ? t('settings.scraper.signedIn', { user: test.data.user, ...counts })
        : t('settings.scraper.anonymous', counts)}
    </p>
  );
}
