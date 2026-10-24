import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

const BUTTON =
  'rounded-md px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none disabled:opacity-40';

/** Remove credentials, after an inline confirmation (nothing is removed by one click). */
export function RemoveCredentials({
  disabled,
  onRemove,
}: {
  disabled: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAsking(true);
        }}
        className={`${BUTTON} text-slate-300 hover:bg-white/10`}
      >
        {t('settings.scraper.remove')}
      </button>
    );
  }
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-question`}
      className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1"
    >
      <span id={`${id}-question`} className="text-xs text-white">
        {t('settings.scraper.removeConfirm')}
      </span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          setAsking(false);
          onRemove();
        }}
        className={`${BUTTON} bg-[#990033] text-white hover:bg-[#b3003b]`}
      >
        {t('settings.scraper.removeYes')}
      </button>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
        }}
        className={`${BUTTON} text-slate-300 hover:bg-white/10`}
      >
        {t('settings.scraper.cancel')}
      </button>
    </div>
  );
}
