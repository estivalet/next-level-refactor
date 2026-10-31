import { useTranslation } from 'react-i18next';

/**
 * S1 Splash: shown while boot steps run, with the NextLevelOS look. `progress` (0..1) is how far
 * boot got: settings, then language and start route, then the account check. `index.html` holds
 * a static copy at 0 % that shows before any script runs: keep the two in step.
 */
export function Splash({
  labelKey = 'boot.loadingSettings',
  progress = 0,
}: {
  labelKey?: string;
  progress?: number;
}) {
  const { t } = useTranslation();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-10 bg-[#05070c] text-white select-none">
      <p className="text-5xl font-black tracking-tight">
        Next<span className="text-sky-400">Level</span>
      </p>
      <div className="w-80 max-w-[80vw]">
        <div
          role="progressbar"
          aria-label={t('boot.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1.5 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-300 ease-out"
            style={{ width: `${String(pct)}%` }}
          />
        </div>
        <p
          role="status"
          className="mt-3 text-center text-xs tracking-widest text-white/50 uppercase"
        >
          {t(labelKey)}
        </p>
      </div>
    </div>
  );
}
