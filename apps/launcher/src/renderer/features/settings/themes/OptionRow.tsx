import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * One theme option (FR-THM-4): label, the default that applies without a value of the user's
 * (the pack's when it sets one), "Use default" once the user set a value, the control and its
 * error. A `role="group"` named by the label.
 */
export function OptionRow({
  id,
  label,
  defaultText,
  fromPack,
  overridden,
  onUseDefault,
  error,
  children,
}: {
  id: string;
  label: string;
  defaultText: string;
  fromPack: boolean;
  overridden: boolean;
  onUseDefault: () => void;
  error?: string | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="flex items-start justify-between gap-6 border-b border-white/5 py-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span id={`${id}-label`} className="text-sm font-medium text-white">
          {label}
        </span>
        <span className="text-xs text-slate-400">
          {t(fromPack ? 'settings.themes.options.packDefault' : 'settings.themes.options.default', {
            value: defaultText,
          })}
        </span>
        {overridden && (
          <button
            type="button"
            aria-label={t('settings.themes.options.useDefaultFor', { label })}
            onClick={onUseDefault}
            className="w-fit text-xs text-sky-300 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            {t('settings.themes.options.useDefault')}
          </button>
        )}
        {error && (
          <p role="alert" className="text-xs text-[#ff8a80]">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">{children}</div>
    </div>
  );
}
