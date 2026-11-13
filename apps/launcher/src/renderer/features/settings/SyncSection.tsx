import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteSynced, useSetSyncEnabled, useSyncNow, useSyncState } from '../sync/syncApi.ts';
import { Switch } from './form/Switch.tsx';

const BUTTON =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50';
const PRIMARY = `${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`;
const SECONDARY = `${BUTTON} bg-white/10 text-white hover:bg-white/20`;

/**
 * Settings → Sync (FR-SET-5, D55): opt in on this PC, see when it last synced (or why it
 * couldn't), Sync now, and Delete synced data (asks first). Main owns the sync section.
 */
export function SyncSection() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const state = useSyncState().data;
  const setEnabled = useSetSyncEnabled();
  const syncNow = useSyncNow();
  const remove = useDeleteSynced();
  const [confirming, setConfirming] = useState(false);
  if (!state) return null;
  const busy = state.syncing || setEnabled.isPending || syncNow.isPending || remove.isPending;
  const status = state.syncing
    ? t('settings.sync.syncing')
    : state.lastSync
      ? t('settings.sync.lastSync', {
          time: new Intl.DateTimeFormat(i18n.language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(state.lastSync)),
        })
      : t('settings.sync.never');

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span id={`${id}-label`} className="text-sm font-medium text-white">
            {t('settings.sync.enabled')}
          </span>
          <p id={`${id}-help`} className="text-xs text-slate-400">
            {t('settings.sync.help')}
          </p>
        </div>
        <Switch
          checked={state.enabled}
          labelledBy={`${id}-label`}
          describedBy={`${id}-help`}
          disabled={setEnabled.isPending}
          onChange={(enabled) => {
            setEnabled.mutate(enabled);
          }}
        />
      </div>
      <p className="text-xs text-slate-400">{t('settings.sync.notSynced')}</p>

      <p className="text-sm text-slate-200" aria-live="polite">
        {status}
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t(`settings.sync.errors.${state.error}`)}
        </p>
      )}
      {(setEnabled.error ?? syncNow.error ?? remove.error) && (
        <p role="alert" className="text-sm text-[#ff8a80]">
          {t('settings.sync.failed')}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={!state.enabled || busy}
          onClick={() => {
            syncNow.mutate(undefined);
          }}
        >
          {t('settings.sync.now')}
        </button>
        {confirming ? (
          <div role="group" aria-label={t('settings.sync.delete')} className="flex flex-col gap-2">
            <p className="text-xs text-slate-300">{t('settings.sync.deleteConfirm')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={PRIMARY}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(undefined, {
                    onSettled: () => {
                      setConfirming(false);
                    },
                  });
                }}
              >
                {t('settings.sync.deleteYes')}
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('settings.sync.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={SECONDARY}
            disabled={busy}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('settings.sync.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
