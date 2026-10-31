// Ported from NextLevelOS src/themes/showcase/HomeView.tsx @ 3d530b7: MenuNodes, translated labels.
import type { MenuNode } from '@nextlevel/shared';
import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CascadingImage } from '../components/CascadingImage.tsx';
import { cn } from '../components/cn.ts';
import { LevelLogo } from '../components/LevelLogo.tsx';
import { ShelfRow } from '../components/ShelfRow.tsx';
import { nodeLabel } from '../engine/levelModel.ts';

export const SC_TILE = 210;
export const SC_TILE_FOCUSED = 300;
export const SC_GAP = 18;
export const SC_BAR = 48;
/** Half a step, so one and a half tiles sit left of the focused one (slot 1). */
export const SC_INSET = Math.round((SC_TILE + SC_GAP) / 2);

export interface HomeViewProps {
  categories: readonly MenuNode[];
  activeCategory: number;
  onSelectCategory: (index: number) => void;
  trail: string;
  clock: ReactNode;
  items: readonly MenuNode[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onActivate: (index: number) => void;
  imageCandidates: (name: string) => string[];
  logoCandidates: (node: MenuNode) => string[];
  hardwareCandidates: (name: string) => string[];
  description: string | null;
  countText: string;
}

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
  imageCandidates,
  logoCandidates,
  hardwareCandidates,
  description,
  countText,
}: HomeViewProps) {
  const { t } = useTranslation();
  const label = (node: MenuNode) => nodeLabel(node, t);
  const catsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el =
      catsRef.current?.querySelector<HTMLElement>('.sc-trail') ??
      catsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    // jsdom has no scrollIntoView.
    if (el && 'scrollIntoView' in el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeCategory, trail]);

  const focused = items[focusIndex] ?? null;
  // Geometry shared with showcase.css: the focused tile sits in slot 1.
  const tileLeft = SC_INSET + SC_TILE + SC_GAP;
  const geometry = {
    '--sc-tile': `${String(SC_TILE)}px`,
    '--sc-tile-focused': `${String(SC_TILE_FOCUSED)}px`,
    '--sc-bar': `${String(SC_BAR)}px`,
    '--sc-tile-left': `${String(tileLeft)}px`,
    '--sc-name-left': `${String(tileLeft + SC_TILE_FOCUSED + 28)}px`,
  } as CSSProperties;

  return (
    <div className="sc-home" style={geometry}>
      <div className="sc-top">
        <div ref={catsRef} className="sc-cats-wrap">
          <div role="tablist" className="sc-cats flex items-center">
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
                  className={cn('sc-cat', i === activeCategory && 'sc-cat--active')}
                >
                  {label(node)}
                </button>
                {i === activeCategory && trail && <span className="sc-trail">› {trail}</span>}
              </Fragment>
            ))}
          </div>
        </div>
        {clock}
      </div>

      {items.length === 0 ? (
        <div className="sc-empty">{t('themes.common.nothingHere')}</div>
      ) : (
        <ShelfRow
          key={activeCategory}
          items={items}
          focusIndex={focusIndex}
          onFocusChange={onFocusChange}
          onActivate={onActivate}
          itemWidth={SC_TILE}
          focusedWidth={SC_TILE_FOCUSED}
          gap={SC_GAP}
          // A single item never repeats, so `focusSlot` does not apply and it would sit in slot
          // 0; inset it to where the focused tile sits in a full row.
          leadingInset={items.length === 1 ? tileLeft : SC_INSET}
          focusSlot={1}
          repeat="always"
          className="sc-shelf"
          renderItem={({ item, focused: isFocused }) => (
            <div className={cn('sc-slot', isFocused && 'sc-slot--focused')}>
              {/* No logo overlay: the focused item's logo already shows at the bottom right. */}
              <div className="sc-tile">
                <CascadingImage
                  srcs={imageCandidates(item.name)}
                  alt=""
                  className="sc-tile-img"
                  // No tile art: the clear logo on the fallback plate, then the name.
                  fallback={
                    <div className="sc-tile-fallback">
                      <CascadingImage
                        srcs={logoCandidates(item)}
                        alt={label(item)}
                        className="sc-tile-logo"
                        fallback={label(item)}
                      />
                    </div>
                  }
                />
              </div>
              {isFocused && (
                // A button like PS5's Explore: one click starts (a tile click only focuses).
                <button
                  type="button"
                  className="sc-start"
                  onMouseDown={keepFocus}
                  onClick={(event) => {
                    event.stopPropagation();
                    onActivate(focusIndex);
                  }}
                >
                  {t('themes.showcase.start')}
                </button>
              )}
            </div>
          )}
        />
      )}

      {focused && (
        <>
          <h1 className="sc-name">{label(focused)}</h1>
          {description ? (
            <p className="sc-desc">{description}</p>
          ) : (
            countText && <p className="sc-desc sc-desc--count">{countText}</p>
          )}
          <div className="sc-side">
            <CascadingImage
              srcs={hardwareCandidates(focused.name)}
              alt=""
              className="sc-hardware"
            />
            <LevelLogo
              candidates={logoCandidates(focused)}
              fallbackText=""
              className="sc-side-logo"
            />
          </div>
        </>
      )}
    </div>
  );
}
