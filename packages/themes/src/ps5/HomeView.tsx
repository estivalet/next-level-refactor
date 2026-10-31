// Ported from NextLevelOS src/themes/ps5/HomeView.tsx @ 3d530b7: MenuNodes, translated labels, art
// from useThemeArt (FR-THM-2) and counts from the host (useGameCount).
import type { MenuNode } from '@nextlevel/shared';
import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArtTile } from '../components/ArtTile.tsx';
import { cn } from '../components/cn.ts';
import { LevelLogo } from '../components/LevelLogo.tsx';
import { ShelfRow } from '../components/ShelfRow.tsx';
import { countLabel, useGameCount } from '../components/useGameCount.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';

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
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const label = (node: MenuNode) => nodeLabel(node, t);
  const images = (node: MenuNode) =>
    art
      .menuBackgroundLayers(node.name)
      .flatMap((layer) => (layer.kind === 'image' ? layer.candidates : []));

  const catsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el =
      catsRef.current?.querySelector<HTMLElement>('.ps5-trail') ??
      catsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom has no scrollIntoView.
    if (el && 'scrollIntoView' in el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeCategory, trail]);

  const focused = items[focusIndex] ?? null;
  const countText = countLabel(useGameCount(focused), t);

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
          itemWidth={104}
          focusedWidth={150}
          gap={16}
          leadingInset={64}
          focusSlot={2}
          className="ps5-shelf"
          renderItem={({ item, focused: isFocused }) => (
            <div className="ps5-shelf-slot">
              <ArtTile
                imageCandidates={images(item)}
                logoCandidates={art.nodeLogo(item)}
                label={label(item)}
                focused={isFocused}
                className={cn('ps5-icon', isFocused && 'ps5-icon--focused')}
                logoClassName="ps5-icon-logo"
                fallbackClassName="ps5-icon-fallback"
              />
              {isFocused && <div className="ps5-icon-label">{label(item)}</div>}
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
          {countText && <div className="ps5-hero-count">{countText}</div>}
          <button
            type="button"
            className="ps5-explore"
            onMouseDown={keepFocus}
            onClick={() => {
              onActivate(focusIndex);
            }}
          >
            {t('themes.ps5.explore')}
          </button>
        </section>
      )}
    </>
  );
}
