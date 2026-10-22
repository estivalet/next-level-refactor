// Ported from NextLevelOS src/themes/ps5/GamesView.tsx @ 3d530b7: ThemeGames through the games
// controller, art from useThemeArt (FR-THM-2), strings via i18n, inline icons. The "Not installed"
// badge is gone: missing games are left out of theme lists.
import { useTranslation } from 'react-i18next';
import { ArtTile } from '../components/ArtTile.tsx';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';
import { GameGrid } from '../components/GameGrid.tsx';
import { tabLabel } from '../components/gameTabs.ts';
import { EyeOffIcon, StarIcon } from '../components/icons.tsx';
import { TabBar } from '../components/TabBar.tsx';
import type { useGamesLevelController } from '../components/useGamesLevelController.ts';
import { isFavorite, isHidden } from '../engine/gameFlags.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';

export const PS5_GRID_COLUMNS = 5;
/** Rows one page jump moves (D5). */
export const PS5_PAGE_ROWS = 2;

type Controller = ReturnType<typeof useGamesLevelController>;

export function GamesView({
  title,
  level,
  controller,
}: {
  title: string;
  level: Extract<Level, { kind: 'games' }>;
  controller: Controller;
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
  const activeLabel = tabs.find((tab) => tab.id === tabbed.activeTabId)?.label ?? '';
  const iconImages = art
    .menuBackgroundLayers(level.node.name)
    .flatMap((layer) => (layer.kind === 'image' ? layer.candidates : []));

  return (
    <div className="ps5-games">
      <svg className="ps5-wave" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ps5-wave-g" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <path
          d="M0 260 C 180 240, 300 120, 600 20"
          stroke="url(#ps5-wave-g)"
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M40 290 C 220 260, 340 150, 600 60"
          stroke="url(#ps5-wave-g)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <header className="ps5-games-header">
        <div className="ps5-games-title">
          <ArtTile
            imageCandidates={iconImages}
            logoCandidates={art.logo(level.node.name)}
            label=""
            focused={false}
            className="ps5-games-icon"
            logoClassName="ps5-icon-logo"
            fallbackClassName="ps5-icon-fallback"
          />
          <span>{title}</span>
        </div>
        <TabBar
          tabs={tabs}
          activeId={tabbed.activeTabId}
          onChange={tabbed.selectTab}
          className="ps5-tabs"
          tabClassName="ps5-tab"
          activeTabClassName="ps5-tab--active"
        />
        <div className="ps5-games-count">
          {activeLabel}: {display.length}
        </div>
      </header>
      <div className="ps5-games-body">
        {level.loading ? (
          <div className="ps5-empty">{t('themes.common.loading')}</div>
        ) : level.error ? (
          <div className="ps5-empty">{t('themes.common.levelFailed', { name: title })}</div>
        ) : display.length === 0 ? (
          <div className="ps5-empty">{t('themes.common.noGamesInTab')}</div>
        ) : (
          <GameGrid
            games={display}
            focusIndex={Math.max(0, tabbed.displayFocus)}
            onFocusChange={tabbed.setDisplayFocus}
            onActivate={(index) => {
              const game = display[index];
              if (game) void controller.play(game);
            }}
            columns={PS5_GRID_COLUMNS}
            rowHeight={200}
            cellAspect={1}
            gap={20}
            className="ps5-grid"
            renderCell={({ game, focused }) => (
              <div className={cn('ps5-cell', focused && 'ps5-cell--focused')}>
                <CascadingImage
                  srcs={art.gameTile(game)}
                  alt={game.title}
                  className="ps5-cell-art"
                  fallback={<div className="ps5-cell-fallback">{game.title}</div>}
                />
                <div className="ps5-cell-badges">
                  {isFavorite(game) && (
                    <span className="ps5-badge" role="img" aria-label={t('themes.tabs.favorites')}>
                      <StarIcon size={12} />
                    </span>
                  )}
                  {isHidden(game) && (
                    <span className="ps5-badge" role="img" aria-label={t('themes.tabs.hidden')}>
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
