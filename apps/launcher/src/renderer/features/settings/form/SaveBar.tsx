import { useTranslation } from 'react-i18next';

const BUTTON =
  'rounded-lg px-4 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

/** S9 save bar: shown while the form has unsaved changes; Save is disabled while invalid. */
export function SaveBar({
  valid,
  saving,
  onSave,
  onDiscard,
}: {
  valid: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="region"
      aria-label={t('settings.saveBar.unsaved')}
      className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-[#1a1c23] px-6 py-3"
    >
      <p className="text-xs text-slate-200">
        {t(valid ? 'settings.saveBar.unsaved' : 'settings.saveBar.invalid')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className={`${BUTTON} text-slate-200 hover:bg-white/10`}
        >
          {t('settings.saveBar.discard')}
        </button>
        <button
          type="button"
          disabled={!valid || saving}
          onClick={onSave}
          className={`${BUTTON} bg-[#990033] text-white hover:bg-[#b3003c]`}
        >
          {t(saving ? 'settings.saveBar.saving' : 'settings.saveBar.save')}
        </button>
      </div>
    </div>
  );
}
