// Ported from NextLevelOS src/themes/big-box/LevelChrome.tsx @ 3d530b7.
import { useTranslation } from 'react-i18next';

/** Big Box's top-right level title + count badge and the breadcrumb above the carousel. */
export function LevelChrome({
  title,
  count,
  trail,
  onBack,
}: {
  title: string;
  count: number;
  trail: string[];
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="absolute top-8 right-8 flex items-center gap-3">
        <span className="bigbox-display text-lg tracking-wider">{title}</span>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: 'var(--bigbox-accent-soft)', color: 'var(--bigbox-accent)' }}
        >
          {count}
        </span>
      </div>

      <div className="bigbox-breadcrumb absolute bottom-[43%] left-8 flex items-center gap-2">
        <button type="button" tabIndex={-1} onClick={onBack} className="hover:text-white">
          &larr; {t('themes.common.back')}
        </button>
        <span className="text-white/30">|</span>
        {trail.length > 0 && <span className="text-white/45">{trail.join(' › ')} ›</span>}
        <span className="font-semibold text-white">{title}</span>
      </div>
    </>
  );
}
