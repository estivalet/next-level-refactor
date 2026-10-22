// Ported from NextLevelOS src/themes/console-home/GamesView.tsx @ 3d530b7: ThemeGames, tile art from
// useThemeArt (FR-THM-2), strings via i18n, inline icons.
import { useTranslation } from 'react-i18next';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';
import { GameGrid } from '../components/GameGrid.tsx';
import { ArrowLeftIcon, EyeOffIcon, SearchIcon, StarIcon } from '../components/icons.tsx';
import { tabLabel } from '../components/gameTabs.ts';
import { TabBar } from '../components/TabBar.tsx';
import type { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { isFavorite, isHidden } from '../engine/gameFlags.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';

export const GRID_COLUMNS = 6;
/** Rows one page jump moves (D5). */
export const PAGE_ROWS = 3;

const keepFocus = (event: { preventDefault: () => void }) => {
  // A click must not move focus off the theme root.
  event.preventDefault();
};

type Controller = ReturnType<typeof useGamesLevelController>;

export function GamesView({
  title,
  controller,
  loading,
  error,
  onBack,
}: {
  title: string;
  controller: Controller;
  loading: boolean;
  error?: string | undefined;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const { tabbed } = controller;
  const display = tabbed.display;
  const tabs = tabbed.tabs.map((tab) => ({
    id: tab.id,
    label: tabLabel(tab, t),
    count: tabbed.counts[tab.id] ?? 0,
  }));
  return (
    <div className="ch-games">
      <div className="ch-games-header">
        <span className="ch-level-title">{title}</span>
        <TabBar
          tabs={tabs}
          activeId={tabbed.activeTabId}
          onChange={tabbed.selectTab}
          className="ch-tabs"
          tabClassName="ch-tab"
          activeTabClassName="ch-tab--active"
        />
        <span className="ch-count">{t('themes.count.games', { count: display.length })}</span>
      </div>
      <div className="ch-games-body">
        <nav className="ch-rail">
          <button
            type="button"
            aria-label={t('themes.common.back')}
            onMouseDown={keepFocus}
            onClick={onBack}
          >
            <ArrowLeftIcon size={26} />
          </button>
          <button
            type="button"
            aria-label={t('themes.common.searchLabel')}
            onMouseDown={keepFocus}
            onClick={tabbed.search.open}
          >
            <SearchIcon size={24} />
          </button>
        </nav>
        {loading ? (
          <div className="ch-empty">{t('themes.common.loading')}</div>
        ) : error ? (
          <div className="ch-empty">{t('themes.common.levelFailed', { name: title })}</div>
        ) : display.length === 0 ? (
          <div className="ch-empty">{t('themes.common.noGamesInTab')}</div>
        ) : (
          <GameGrid
            games={display}
            focusIndex={Math.max(0, tabbed.displayFocus)}
            onFocusChange={tabbed.setDisplayFocus}
            onActivate={(index) => {
              const game = display[index];
              if (game) void controller.play(game);
            }}
            columns={GRID_COLUMNS}
            rowHeight={190}
            cellAspect={1}
            gap={20}
            className="ch-grid"
            renderCell={({ game, focused }) => (
              <div className={cn('ch-cell', focused && 'ch-cell--focused')}>
                <CascadingImage
                  srcs={art.gameTile(game)}
                  alt={game.title}
                  className="ch-cell-art"
                  fallback={<div className="ch-cell-fallback">{game.title}</div>}
                />
                <div className="ch-cell-badges">
                  {isFavorite(game) && (
                    <span className="ch-badge" role="img" aria-label={t('themes.tabs.favorites')}>
                      <StarIcon size={12} />
                    </span>
                  )}
                  {isHidden(game) && (
                    <span className="ch-badge" role="img" aria-label={t('themes.tabs.hidden')}>
                      <EyeOffIcon size={12} />
                    </span>
                  )}
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
