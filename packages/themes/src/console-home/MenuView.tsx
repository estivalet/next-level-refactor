// Console Home's menu level: a row of art tiles, split out of NextLevelOS
// src/themes/console-home/ConsoleHomeTheme.tsx @ 3d530b7.
import type { MenuNode } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { ArtTile } from '../components/ArtTile.tsx';
import { Carousel } from '../components/Carousel.tsx';
import { cn } from '../components/cn.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';

export function MenuView({
  items,
  focusIndex,
  onFocusChange,
  onEnter,
}: {
  items: readonly MenuNode[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  onEnter: (index: number) => void;
}) {
  const { t } = useTranslation();
  const art = useThemeArt();
  if (items.length === 0) {
    return <div className="ch-empty absolute inset-0">{t('themes.common.nothingHere')}</div>;
  }
  return (
    <div className="ch-menu-band">
      <Carousel
        items={items}
        focusIndex={focusIndex}
        onFocusChange={onFocusChange}
        onActivate={onEnter}
        itemWidth={240}
        gap={28}
        visibleRadius={6}
        className="h-full"
        renderItem={({ item, focused }) => (
          <div className="flex h-full items-center justify-center">
            <ArtTile
              imageCandidates={art
                .menuBackgroundLayers(item.name)
                .flatMap((layer) => (layer.kind === 'image' ? layer.candidates : []))}
              logoCandidates={art.logo(item.name)}
              label={nodeLabel(item, t)}
              focused={focused}
              className={cn('ch-tile', focused && 'ch-tile--focused')}
              logoClassName="ch-tile-logo"
              fallbackClassName="ch-tile-fallback"
            />
          </div>
        )}
      />
    </div>
  );
}
