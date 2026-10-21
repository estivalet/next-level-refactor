import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apps, type AppId } from '../../apps/registry.ts';
import { useOpenApp } from './useOpenApp.ts';

/** Desktop shortcuts: a single click selects (focuses), double-click or Enter/Space opens. */
export function DesktopIcons() {
  const { t } = useTranslation();
  const openApp = useOpenApp();

  function onKeyDown(event: KeyboardEvent, id: AppId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openApp(id);
    }
  }

  return (
    <nav aria-label={t('shell.desktop.apps')} className="absolute top-4 left-4 flex flex-col gap-2">
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          onDoubleClick={() => {
            openApp(app.id);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, app.id);
          }}
          className="flex w-20 flex-col items-center gap-1 rounded-lg p-2 text-xs text-slate-200 hover:bg-white/10 focus-visible:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        >
          <app.icon aria-hidden="true" className="h-9 w-9 text-white drop-shadow" />
          <span className="text-center drop-shadow">{t(app.titleKey)}</span>
        </button>
      ))}
    </nav>
  );
}
