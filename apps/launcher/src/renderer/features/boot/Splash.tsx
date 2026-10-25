import { useTranslation } from 'react-i18next';

/** S1 Splash: shown while boot steps run. */
export function Splash({ labelKey = 'boot.loadingSettings' }: { labelKey?: string }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] text-slate-200">
      <p className="text-3xl font-bold tracking-wide text-white">NextLevel</p>
      <p role="status" className="text-sm text-slate-300">
        {t(labelKey)}
      </p>
    </div>
  );
}
