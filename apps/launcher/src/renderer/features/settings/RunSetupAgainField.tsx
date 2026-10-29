import { useTranslation } from 'react-i18next';
import type { SettingsDraft } from './form/useSettingsDraft.ts';

/**
 * Settings → General → Run setup again (D48): clears the setup completion; once saved, the
 * first-run wizard shows at the next start.
 */
export function RunSetupAgainField({ draft, update }: Pick<SettingsDraft, 'draft' | 'update'>) {
  const { t } = useTranslation();
  const pending = draft.general.setupCompletedAt === null;
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-white">{t('settings.general.runSetup')}</p>
        <p className="text-xs text-slate-400">
          {pending ? t('settings.general.runSetupDone') : t('settings.general.runSetupHelp')}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          update((current) => ({
            ...current,
            general: { ...current.general, setupCompletedAt: null },
          }));
        }}
        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
      >
        {t('settings.general.runSetup')}
      </button>
    </div>
  );
}
