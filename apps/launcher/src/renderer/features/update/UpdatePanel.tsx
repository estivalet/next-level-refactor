import type { UpdateState } from '@nextlevel/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  useCheckForUpdates,
  useOpenReleasePage,
  useRestartToUpdate,
  useUpdateState,
} from './updateApi.ts';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';
const PRIMARY = `${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`;
const SECONDARY = `${BUTTON} bg-white/10 text-white hover:bg-white/20`;

/** One line saying what the updater is doing (NFR-UPD-1). */
export function updateMessage(t: TFunction, state: UpdateState, language: string): string {
  switch (state.kind) {
    case 'idle':
      return state.lastCheck
        ? t('update.upToDate', { when: new Date(state.lastCheck).toLocaleString(language) })
        : t('update.notChecked');
    case 'checking':
      return t('update.checking');
    case 'downloading':
      return t('update.downloading', { version: state.version, percent: state.percent });
    case 'ready':
      return t('update.ready', { version: state.version });
    case 'error':
      return t(`update.errors.${state.code}`);
    case 'unsupported':
      return t(state.reason === 'dev' ? 'update.dev' : 'update.zip');
  }
}

/**
 * The update status and its actions (D53), on Settings → About and the Update required screen.
 * `checkLabel` names the check button ("Check now", or "Update now" when the API needs one).
 */
export function UpdatePanel({
  checkLabel,
  autoFocus = false,
}: {
  checkLabel: string;
  autoFocus?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const state = useUpdateState().data;
  const check = useCheckForUpdates();
  const restart = useRestartToUpdate();
  const openRelease = useOpenReleasePage();
  if (!state) return null;
  const busy = state.kind === 'checking' || state.kind === 'downloading';
  const zip = state.kind === 'unsupported' && state.reason === 'zip';
  const canCheck = !(state.kind === 'unsupported' && state.reason === 'dev');

  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-sm text-slate-300">
        {updateMessage(t, state, i18n.language)}
      </p>
      {zip && state.availableVersion && (
        <p className="text-sm text-white">
          {t('update.available', { version: state.availableVersion })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {state.kind === 'ready' && (
          <button
            type="button"
            autoFocus={autoFocus}
            className={PRIMARY}
            disabled={restart.isPending}
            onClick={() => {
              restart.mutate();
            }}
          >
            {t('update.restart')}
          </button>
        )}
        {zip && (
          <button
            type="button"
            autoFocus={autoFocus}
            className={state.availableVersion ? PRIMARY : SECONDARY}
            onClick={() => {
              openRelease.mutate();
            }}
          >
            {t('update.openRelease')}
          </button>
        )}
        {canCheck && !zip && (
          <button
            type="button"
            autoFocus={autoFocus && state.kind !== 'ready'}
            className={SECONDARY}
            disabled={busy || state.kind === 'ready' || check.isPending}
            onClick={() => {
              check.mutate();
            }}
          >
            {checkLabel}
          </button>
        )}
      </div>
    </div>
  );
}
