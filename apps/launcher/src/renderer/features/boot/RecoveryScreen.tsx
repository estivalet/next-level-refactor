import { useTranslation } from 'react-i18next';
import { useOpenPath, useResetSettings, useRestoreBackup } from '../settings/settingsApi.ts';

type Reason = 'unreadable' | 'invalid' | 'newerVersion' | 'unavailable';

const BUTTON =
  'rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Shown instead of the shell when settings.json can't be used (data model §2.2): the file is never
 * overwritten silently; the user restores the latest backup or resets to defaults.
 */
export function RecoveryScreen({
  reason,
  latestBackupId,
}: {
  reason: Reason;
  latestBackupId: string | null;
}) {
  const { t } = useTranslation();
  const restore = useRestoreBackup();
  const reset = useResetSettings();
  const openPath = useOpenPath();
  const busy = restore.isPending || reset.isPending;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] p-6 text-slate-200">
      <section
        aria-labelledby="recovery-title"
        className="flex max-w-lg flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1c23]/95 p-8 shadow-2xl"
      >
        <h1 id="recovery-title" className="text-xl font-semibold text-white">
          {t('boot.recovery.title')}
        </h1>
        <p className="text-sm text-slate-300">{t(`boot.recovery.reason.${reason}`)}</p>
        <p className="text-sm text-slate-300">{t('boot.recovery.keep')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!latestBackupId || busy}
            onClick={() => {
              if (latestBackupId) restore.mutate(latestBackupId);
            }}
            className={`${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`}
          >
            {t('boot.recovery.restoreLatest')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              reset.mutate(undefined);
            }}
            className={`${BUTTON} bg-white/10 text-white hover:bg-white/20`}
          >
            {t('boot.recovery.resetDefaults')}
          </button>
          <button
            type="button"
            onClick={() => {
              openPath.mutate('data');
            }}
            className={`${BUTTON} text-slate-200 hover:bg-white/10`}
          >
            {t('boot.recovery.openDataFolder')}
          </button>
        </div>
      </section>
    </div>
  );
}
