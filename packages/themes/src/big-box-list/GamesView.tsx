// Ported from NextLevelOS src/themes/big-box-list/GamesView.tsx @ 3d530b7: ThemeGames, strings via
// i18n, S5 tabs in the header, and a year · developer · genre line instead of the ROM file name.
import './big-box-list.css';
import type { ThemeGame } from '@nextlevel/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';
import { HintBar, type Hint } from '../components/HintBar.tsx';
import { SearchIcon } from '../components/icons.tsx';
import { StatusBar } from '../components/StatusBar.tsx';
import { VerticalWheel, type WheelSlotStyle } from '../components/VerticalWheel.tsx';

export const ROW_HEIGHT = 50;

/** A flat column: rows stack straight down, keep their size and dim with distance. */
export function listSlotStyle(distance: number, rowHeight = ROW_HEIGHT): WheelSlotStyle {
  const a = Math.abs(distance);
  return {
    y: distance * rowHeight,
    x: 0,
    scale: 1,
    opacity: a === 0 ? 1 : Math.max(0.3, 0.75 - 0.06 * a),
    zIndex: 100 - a,
  };
}

/** The line under the logo: year · developer · genre, whichever are known. */
export function gameMeta(game: ThemeGame): string {
  return [game.year === null ? null : String(game.year), game.developer, game.genre]
    .filter((part): part is string => !!part)
    .join(' · ');
}

export interface GamesViewProps {
  title: string;
  badge: string | null;
  /** The rows to show (tab- and search-filtered). */
  games: readonly ThemeGame[];
  /** Index into `games`. */
  focusIndex: number;
  focusedGame: ThemeGame | null;
  boxArtSrcs: string[];
  /** The focused game's clear-logo candidates; its title stands in when none loads. */
  logoSrcs: string[];
  /** The filter this list was opened through (e.g. "Official"), shown after the count. */
  filterLabel: string | null;
  status: 'loading' | 'error' | 'ready';
  hints: Hint[];
  /** The search input, rendered under the header. */
  search?: ReactNode;
  /** The S5 tab bar, rendered in the header. */
  tabs?: ReactNode;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  onToggleSearch: () => void;
}

/** Big Box List's games level: text list on a slanted left panel, art on the right. */
export function GamesView({
  title,
  badge,
  games,
  focusIndex,
  focusedGame,
  boxArtSrcs,
  logoSrcs,
  filterLabel,
  status,
  hints,
  search,
  tabs,
  onFocusChange,
  onActivate,
  onToggleSearch,
}: GamesViewProps) {
  const { t } = useTranslation();
  const message =
    status === 'loading'
      ? t('themes.common.loading')
      : status === 'error'
        ? t('themes.common.levelFailed', { name: title })
        : games.length === 0
          ? t('themes.common.noGames')
          : null;
  const meta = focusedGame ? gameMeta(focusedGame) : '';

  return (
    <div className="bbl-games absolute inset-0">
      <div className="bbl-panel-edge" aria-hidden />
      <div className="bbl-panel">
        <header className="bbl-header">
          <div className="bbl-brand">
            <span className="bbl-brand-mark" />
            {t('themes.common.brand')}
          </div>
          <h1 className="bigbox-display bbl-title">{title}</h1>
          {status === 'ready' && (
            <div className="bbl-count">
              {t('themes.count.games', { count: games.length })}
              {filterLabel && (
                <>
                  {' · '}
                  <span className="bbl-count-filter">{filterLabel}</span>
                </>
              )}
            </div>
          )}
          {tabs}
          {search}
        </header>
        <div
          className="bbl-list"
          // While search is open keep the keyboard in the search box: a click would move it to
          // the theme root, where input is off until the search closes.
          onMouseDown={
            search
              ? (event) => {
                  event.preventDefault();
                }
              : undefined
          }
        >
          {message ? (
            <div className="flex h-full items-center justify-center text-sm text-white/60">
              {message}
            </div>
          ) : (
            <VerticalWheel
              items={games}
              focusIndex={focusIndex}
              onFocusChange={onFocusChange}
              onActivate={onActivate}
              slotHeight={ROW_HEIGHT}
              slotStyle={(d) => listSlotStyle(d)}
              fill
              className="h-full"
              renderItem={({ item, focused }) => (
                <div className={cn('bigbox-display bbl-row', focused && 'bbl-row--focused')}>
                  {item.title}
                </div>
              )}
            />
          )}
        </div>
      </div>

      <div className="absolute top-5 right-8 z-10 flex items-center gap-5">
        <button
          type="button"
          aria-label={t('themes.common.searchLabel')}
          className="bbl-icon-btn"
          // Keep keyboard focus on the theme root.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={onToggleSearch}
        >
          <SearchIcon size={22} />
        </button>
        <StatusBar clockClassName="bbl-clock" />
      </div>

      {focusedGame && (
        <>
          <div className="bbl-game-info">
            <div className="bbl-game-logo">
              <CascadingImage
                srcs={logoSrcs}
                alt={focusedGame.title}
                className="bbl-logo-img"
                fallback={<span className="bigbox-display bbl-logo-text">{focusedGame.title}</span>}
              />
            </div>
            <div className="bbl-file-row">
              {badge && <span className="bbl-badge">{badge}</span>}
              {meta && <span className="bbl-file">{meta}</span>}
            </div>
          </div>
          <CascadingImage srcs={boxArtSrcs} alt="" className="bbl-boxart" />
        </>
      )}

      <HintBar hints={hints} className="bbl-hints" keyClassName="bbl-hint-key" />
    </div>
  );
}
