// Ported from NextLevelOS src/themes/showcase/GamesView.tsx @ 3d530b7: ThemeGames keyed by id,
// strings via i18n, inline icons. The "Not installed" badge is gone: missing games are left out
// of theme lists.
import type { ThemeGame } from '@nextlevel/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Carousel } from '../components/Carousel.tsx';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';
import { TabBar, type TabBarItem } from '../components/TabBar.tsx';
import { GameInfo } from './GameInfo.tsx';
import { VideoWindow } from './VideoWindow.tsx';

export interface GamesViewProps {
  title: string;
  /** Clear-logo candidates for the system; its name shows as text without art. */
  systemLogo: string[];
  /** Logo fallback text; defaults to `title`. */
  systemName?: string;
  /** A filter level's name (e.g. "Official"), shown as text under the system logo. */
  filterLabel?: string | undefined;
  game: ThemeGame | null;
  videoCandidates: string[];
  /** Id of the game `videoCandidates` belong to (they settle after focus). */
  videoFor: number | null;
  tabs: TabBarItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  display: readonly ThemeGame[];
  displayFocus: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  artCandidates: (game: ThemeGame) => string[];
  loading: boolean;
  error?: string | undefined;
}

/** Games level: info block top-left, video window top-right, tabs + count, cover strip. */
export function GamesView({
  title,
  systemLogo,
  systemName,
  filterLabel,
  game,
  videoCandidates,
  videoFor,
  tabs,
  activeTabId,
  onSelectTab,
  display,
  displayFocus,
  onFocusChange,
  onActivate,
  artCandidates,
  loading,
  error,
}: GamesViewProps) {
  const { t } = useTranslation();
  // Keep the active tab in view when a system has more filters than fit.
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom has no scrollIntoView.
    if (el && 'scrollIntoView' in el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeTabId]);
  const n = display.length;
  return (
    <div className="sc-games">
      {game && (
        <GameInfo
          game={game}
          systemName={systemName ?? title}
          systemLogo={systemLogo}
          filterLabel={filterLabel}
        />
      )}
      {/* Only the focused game's own video: while focus has moved but not settled yet, the
          previous game's video is hidden, not shown beside the new game's info. */}
      {game && videoFor === game.id && videoCandidates.length > 0 && (
        <VideoWindow candidates={videoCandidates} />
      )}

      <div className="sc-strip-head">
        <div ref={tabsRef} className="sc-tabs-wrap">
          <TabBar
            tabs={tabs}
            activeId={activeTabId}
            onChange={onSelectTab}
            className="sc-tabs"
            tabClassName="sc-tab"
            activeTabClassName="sc-tab--active"
          />
        </div>
        <span className="sc-count">{t('themes.count.games', { count: n })}</span>
      </div>

      <div className="sc-strip">
        {loading ? (
          <div className="sc-empty">{t('themes.common.loading')}</div>
        ) : error ? (
          <div className="sc-empty">{t('themes.common.levelFailed', { name: title })}</div>
        ) : n === 0 ? (
          <div className="sc-empty">{t('themes.common.noGamesInTab')}</div>
        ) : (
          <Carousel
            items={display}
            focusIndex={Math.max(0, Math.min(displayFocus, n - 1))}
            onFocusChange={onFocusChange}
            onActivate={onActivate}
            // A tighter step than NextLevelOS's 250/18 so the strip runs past both edges with
            // partial covers peeking in, like Big Box. Cover size is set by the strip height,
            // not the slot, so this changes only the spacing.
            itemWidth={226}
            gap={14}
            // The strip is 44vh: 226/14 px were tuned on a 1080p screen (≈ 432 px tall), and
            // scale from there so the spacing holds at any size or UI scale.
            referenceHeight={432}
            visibleRadius={6}
            className="h-full"
            renderItem={({ item, focused }) => (
              <div className="sc-cover-slot">
                <CascadingImage
                  srcs={artCandidates(item)}
                  alt={item.title}
                  className={cn('sc-cover', focused && 'sc-cover--focused')}
                  fallback={
                    <div
                      className={cn('sc-cover sc-cover-fallback', focused && 'sc-cover--focused')}
                    >
                      {item.title}
                    </div>
                  }
                />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
