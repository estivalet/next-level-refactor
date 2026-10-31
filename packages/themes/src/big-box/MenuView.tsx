// Ported from NextLevelOS src/themes/big-box/MenuView.tsx @ 3d530b7: nodes are MenuNodes with
// translated labels, and the card shows the focused item's game or item count.
import type { MenuNode } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { Carousel } from '../components/Carousel.tsx';
import { cn } from '../components/cn.ts';
import { LevelLogo } from '../components/LevelLogo.tsx';
import { countLabel, useGameCount } from '../components/useGameCount.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import { LevelChrome } from './LevelChrome.tsx';

export type MenuLevel = Extract<Level, { kind: 'menu' }>;

/**
 * Big Box's menu level: detail card, level title + count, breadcrumb and the logo-plate
 * carousel. The theme sets `--bigbox-accent` / `--bigbox-accent-soft` on an ancestor.
 */
export function MenuView({
  level,
  focusIndex,
  trail,
  onFocusChange,
  onEnter,
  onBack,
}: {
  level: MenuLevel;
  focusIndex: number;
  trail: string[];
  onFocusChange: (index: number) => void;
  onEnter: (index: number) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  const items = level.items;
  const focused: MenuNode | null = items[focusIndex] ?? null;
  const count = countLabel(useGameCount(focused), t);
  const title = level.node ? nodeLabel(level.node, t) : level.title;

  return (
    <>
      <div
        className={cn(
          'bigbox-card absolute top-8 left-8 max-w-[36rem] p-6',
          !focused && 'invisible',
        )}
      >
        {focused && (
          <>
            <LevelLogo
              candidates={art.nodeLogo(focused)}
              fallbackText={nodeLabel(focused, t)}
              className="bigbox-display block max-h-32 text-5xl leading-none font-black"
            />
            <div
              className="mt-3 text-xs font-semibold tracking-[0.2em] uppercase"
              style={{ color: 'var(--bigbox-accent)' }}
            >
              {t(`themes.bigBox.types.${focused.type}`)}
              {count && ` · ${count}`}
            </div>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onEnter(focusIndex);
              }}
              className="bigbox-display mt-4 rounded-md bg-white px-5 py-2 text-sm font-bold tracking-wider text-black hover:bg-white/90"
            >
              {t('themes.common.open')} &rsaquo;
            </button>
          </>
        )}
      </div>

      <LevelChrome title={title} count={items.length} trail={trail} onBack={onBack} />

      <div className="absolute inset-x-0 bottom-0 h-[42%] pb-12">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            {t('themes.common.nothingHere')}
          </div>
        ) : (
          <Carousel
            items={items}
            focusIndex={focusIndex}
            onFocusChange={onFocusChange}
            onActivate={onEnter}
            itemWidth={260}
            gap={16}
            visibleRadius={7}
            className="h-full"
            renderItem={({ item, focused: isFocused }) => (
              <div className="flex h-full items-center justify-center">
                <div
                  className={cn(
                    'bigbox-carousel-plate flex h-44 w-full items-center justify-center p-4',
                    isFocused ? 'bigbox-carousel-item--focused' : 'bigbox-carousel-item--dim',
                  )}
                >
                  <LevelLogo
                    candidates={art.nodeLogo(item)}
                    fallbackText={nodeLabel(item, t)}
                    className="bigbox-display max-h-full text-center text-xl font-bold"
                  />
                </div>
              </div>
            )}
          />
        )}
      </div>
    </>
  );
}
