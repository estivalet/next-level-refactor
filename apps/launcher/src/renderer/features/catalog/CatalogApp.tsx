import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayLayer } from '../library/PlayLayer.tsx';
import { usePlay } from '../library/usePlay.ts';
import type { AppParams } from '../shell/windowManager.ts';
import { BrowseTab } from './BrowseTab.tsx';
import { useCatalogEvents } from './catalogApi.ts';
import { DownloadsTab } from './DownloadsTab.tsx';
import { InstalledTab } from './InstalledTab.tsx';

const TABS = ['browse', 'installed', 'downloads'] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | undefined): value is Tab => TABS.some((tab) => tab === value);

/**
 * The Catalog app (S8, D47): Browse · Installed · Downloads. `params.tab` opens a tab (the tray
 * opens Downloads), also when the window was already open.
 */
export function CatalogApp({ params }: { params?: AppParams }) {
  const { t } = useTranslation();
  useCatalogEvents();
  const requested = params?.['tab'];
  const [view, setView] = useState<{ tab: Tab; seen: AppParams | undefined }>({
    tab: isTab(requested) ? requested : 'browse',
    seen: params,
  });
  // Each open request from outside (the tray) is a new params object: it wins over the tab
  // picked here, even when it asks for the same tab as last time.
  if (params !== view.seen) {
    setView({ tab: isTab(requested) ? requested : view.tab, seen: params });
  }
  const tab = view.tab;
  const play = usePlay({ onFinished: () => undefined });

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label={t('apps.catalog.title')}
        className="flex gap-1 border-b border-white/10 px-3 pt-2"
      >
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => {
              setView({ tab: name, seen: params });
            }}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none ${tab === name ? 'border-sky-400 text-white' : 'border-transparent text-slate-300 hover:text-white'}`}
          >
            {t(`catalog.tabs.${name}`)}
          </button>
        ))}
      </div>
      {tab === 'browse' && <BrowseTab onPlay={play.play} />}
      {tab === 'installed' && <InstalledTab onPlay={play.play} />}
      {tab === 'downloads' && <DownloadsTab />}
      <PlayLayer play={play} />
    </div>
  );
}
