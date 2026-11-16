// Ported from NextLevelOS src/themes/ps5/HomeView.tsx @ 3d530b7: MenuNodes, translated labels, art
// from useThemeArt (FR-THM-2) and counts from the host (useGameCount).
import type { MenuNode } from '@nextlevel/shared';
import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArtTile } from '../components/ArtTile.tsx';
import { cn } from '../components/cn.ts';
import { LevelLogo } from '../components/LevelLogo.tsx';
import { ShelfRow } from '../components/ShelfRow.tsx';
import { useGameCount } from '../components/useGameCount.ts';
import { useThemeSystemInfo } from '../components/useSystemInfo.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { HeroMeta, HomeStats } from './HomeParts.tsx';
import { PS5_SHELF, ShelfTitle } from './ShelfTitle.tsx';
import type { HeroButton } from './useHomeZones.ts';

const keepFocus = (event: { preventDefault: () => void }) => {
  // A click must not move focus off the theme root.
  event.preventDefault();
};

export function HomeView({
  categories,
  activeCategory,
  onSelectCategory,
  trail,
  clock,
  items,
  focusIndex,
  onFocusChange,
  onActivate,
  heroFocus,
  onInfo,
}: {
  categories: readonly MenuNode[];
  activeCategory: number;
  onSelectCategory: (index: number) => void;
  trail: string;
  clock: ReactNode;
  items: readonly MenuNode[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  /** The focused hero button; null while focus is on the shelf (FR-MUS-4). */
  heroFocus: HeroButton | null;
  /** Opens the focused system's museum page. */
  onInfo: () => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const label = (node: MenuNode) => nodeLabel(node, t);

  const catsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el =
      catsRef.current?.querySelector<HTMLElement>('.ps5-trail') ??
      catsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom has no scrollIntoView.
    if (el && 'scrollIntoView' in el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeCategory, trail]);

  const focused = items[focusIndex] ?? null;
  // A system whose children are filters (official, favorite…) still counts its games.
  const count = useGameCount(focused, 250, { filtersAsGames: true });
  // FR-THM-1: the museum entry names the system and its maker; the label stands in while it loads.
  // Filter tiles carry their system's id; only a system node takes the museum's name and maker.
  const systemFocused = focused?.type === 'system';
  const info = useThemeSystemInfo(systemFocused ? (focused.systemId ?? null) : null);

  return (
    <>
      <div className="ps5-top">
        <div ref={catsRef} className="ps5-cats-wrap">
          <div role="tablist" className="ps5-cats flex items-center">
            {categories.map((node, i) => (
              <Fragment key={node.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === activeCategory}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    onSelectCategory(i);
                  }}
                  className={cn('ps5-cat', i === activeCategory && 'ps5-cat--active')}
                >
                  {label(node)}
                </button>
                {i === activeCategory && trail && <span className="ps5-trail">› {trail}</span>}
              </Fragment>
            ))}
          </div>
        </div>
        {clock}
      </div>

      {items.length === 0 ? (
        <div className="ps5-empty">{t('themes.common.nothingHere')}</div>
      ) : (
        <ShelfRow
          key={activeCategory}
          items={items}
          focusIndex={focusIndex}
          onFocusChange={onFocusChange}
          onActivate={onActivate}
          {...PS5_SHELF}
          focusSlot={2}
          className="ps5-shelf"
          renderItem={({ item, focused: isFocused }) => (
            <div className="ps5-shelf-slot">
              <ArtTile
                imageCandidates={art.menuTile(item.name)}
                logoCandidates={art.nodeLogo(item)}
                label={label(item)}
                focused={isFocused}
                className={cn('ps5-icon', isFocused && 'ps5-icon--focused')}
                logoClassName="ps5-icon-logo"
                fallbackClassName="ps5-icon-fallback"
              />
              {isFocused && (
                <ShelfTitle
                  shortName={item.shortName}
                  name={(item.type === 'system' && info?.fullName) || label(item)}
                  measureKey={`${String(focusIndex)}/${String(items.length)}`}
                />
              )}
            </div>
          )}
        />
      )}

      {focused && (
        <section className="ps5-hero">
          <LevelLogo
            candidates={art.nodeLogo(focused)}
            fallbackText={label(focused)}
            className="ps5-hero-logo"
          />
          {systemFocused && <HeroMeta info={info} />}
          <div className="ps5-hero-actions">
            <button
              type="button"
              className={cn('ps5-explore', heroFocus === 'explore' && 'ps5-hero-btn--focused')}
              onMouseDown={keepFocus}
              onClick={() => {
                onActivate(focusIndex);
              }}
            >
              {t('themes.ps5.explore')}
            </button>
            {focused.systemId && (
              <button
                type="button"
                aria-label={t('themes.ps5.moreInfo')}
                className={cn('ps5-more', heroFocus === 'info' && 'ps5-hero-btn--focused')}
                onMouseDown={keepFocus}
                onClick={onInfo}
              >
                …
              </button>
            )}
          </div>
        </section>
      )}
      {focused && <HomeStats count={count} />}
    </>
  );
}
