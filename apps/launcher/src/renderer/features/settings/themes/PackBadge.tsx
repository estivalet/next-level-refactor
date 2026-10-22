import type { ThemeArtOptions } from '@nextlevel/shared';
import type { ThemeModule } from '@nextlevel/themes';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CoveragePanel, packBadgeKey } from './CoveragePanel.tsx';
import { useThemeCoverage } from './useThemeCoverage.ts';

/** A theme card's pack status; a click opens its coverage panel (FR-THM-2). */
export function PackBadge({
  theme,
  userArt,
}: {
  theme: ThemeModule;
  userArt: ThemeArtOptions | undefined;
}) {
  const { t } = useTranslation();
  const info = useThemeCoverage(theme, userArt);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const badge = packBadgeKey(info);
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="w-fit rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {t(badge.key, { percent: badge.percent })}
      </button>
      {open && (
        <CoveragePanel
          theme={theme}
          info={info}
          onClose={() => {
            setOpen(false);
            button.current?.focus(); // back to the badge (NFR-A11Y-1)
          }}
        />
      )}
    </>
  );
}
