import type { ImportSummary } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { SECONDARY_BUTTON } from '../../library/Modal.tsx';
import { useOpenApp } from '../../shell/useOpenApp.ts';

/** What an import did (US-B3), with the apps to look at the result in. */
export function ImportSummaryView({ summary }: { summary: ImportSummary }) {
  const { t, i18n } = useTranslation();
  const openApp = useOpenApp();
  const format = (n: number) => n.toLocaleString(i18n.language);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-sm text-white">
        {t('settings.import.summary', {
          games: format(summary.games.matched + summary.games.inserted),
          missing: format(summary.games.missing),
          collections: format(summary.collections),
          menus: format(summary.menus),
        })}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => {
            openApp('library');
          }}
        >
          {t('settings.import.openLibrary')}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => {
            openApp('menu-editor');
          }}
        >
          {t('settings.import.openMenuEditor')}
        </button>
      </div>
    </div>
  );
}
