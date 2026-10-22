import type { CoverageSlot, ThemeModule } from '@nextlevel/themes';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setPreviewWithoutFallback, useThemeArtSession } from '../../frontend/themeArtSession.ts';
import { useRescanArt, type ThemeCoverageInfo } from './useThemeCoverage.ts';

const SLOTS: readonly CoverageSlot[] = ['logo', 'background', 'video', 'wallpaper'];
const BUTTON =
  'rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none';

/** The card's pack status: `No pack` or `Art NN%` (FR-THM-2). */
export function packBadgeKey(info: ThemeCoverageInfo): { key: string; percent?: number } {
  if (info.status === 'loading') return { key: 'settings.themes.coverage.loading' };
  if (!info.hasPack) return { key: 'settings.themes.coverage.noPack' };
  return { key: 'settings.themes.coverage.percent', percent: info.coverage?.percent ?? 0 };
}

/**
 * A theme's art coverage (FR-THM-2): the pack's details, per slot how many menu items its pack
 * covers and which are missing, the pack's warnings, Preview without fallback (this session
 * only) and Rescan art.
 */
export function CoveragePanel({
  theme,
  info,
  onClose,
}: {
  theme: ThemeModule;
  info: ThemeCoverageInfo;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = t(theme.nameKey);
  const preview = useThemeArtSession().preview.has(theme.id);
  const rescan = useRescanArt(theme.id);
  const [rescanning, setRescanning] = useState(false);
  const manifest = info.index?.manifest;
  const meta = [
    manifest?.version && `v${manifest.version}`,
    manifest?.author,
    manifest?.description,
  ]
    .filter(Boolean)
    .join(' · ');
  const coverage = info.coverage;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.themes.coverage.title', { name })}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-hidden rounded-xl border border-white/10 bg-[#0b0f18] p-6 text-white">
        <h2 className="text-lg font-semibold">{t('settings.themes.coverage.heading', { name })}</h2>
        {meta && <p className="text-xs text-slate-400">{meta}</p>}
        {!info.hasPack && info.status === 'ready' && (
          <p className="text-sm text-slate-300">{t('settings.themes.coverage.noPackHelp')}</p>
        )}
        {coverage && (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {SLOTS.filter((slot) => coverage.slots[slot].total > 0).map((slot) => {
              const c = coverage.slots[slot];
              return (
                <details key={slot} className="rounded bg-white/5 px-3 py-2">
                  <summary className="cursor-pointer text-sm">
                    {t(`settings.themes.coverage.slots.${slot}`, { have: c.have, total: c.total })}
                  </summary>
                  {c.missing.length > 0 ? (
                    <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-slate-400">
                      {c.missing.map((missing) => (
                        <li key={missing}>{missing}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      {t('settings.themes.coverage.complete')}
                    </p>
                  )}
                </details>
              );
            })}
          </div>
        )}
        {(info.index?.warnings.length ?? 0) > 0 && (
          <ul
            aria-label={t('settings.themes.coverage.warningsLabel')}
            className="flex flex-col gap-1"
          >
            {info.index?.warnings.map((warning, i) => (
              <li key={i} className="text-xs text-amber-300">
                {t(`settings.themes.coverage.warnings.${warning.code}`, { field: warning.field })}
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preview}
            onChange={(event) => {
              setPreviewWithoutFallback(theme.id, event.target.checked);
            }}
          />
          {t('settings.themes.coverage.preview')}
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={rescanning}
            onClick={() => {
              setRescanning(true);
              void rescan().finally(() => {
                setRescanning(false);
              });
            }}
            className={BUTTON}
          >
            {t('settings.themes.coverage.rescan')}
          </button>
          {/* Focused on open so Escape (handled on the dialog) reaches it. */}
          <button type="button" autoFocus onClick={onClose} className={BUTTON}>
            {t('settings.themes.coverage.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
