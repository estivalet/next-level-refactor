// HyperSpin's wheel column: menu items or games on the arc, sliding in from the side the user
// came from, with the pointer fixed at the center.
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VerticalWheel } from '../components/VerticalWheel.tsx';
import { nodeLabel } from '../engine/levelModel.ts';
import { levelPop, levelPush } from '../engine/transitions.ts';
import type { ThemeArtApi } from '../engine/useThemeArt.ts';
import { HyperspinPointer } from './HyperspinPointer.tsx';
import { hyperspinSlotStyle } from './wheelArc.ts';
import { WheelItem } from './WheelItem.tsx';
import type { WheelSettings } from './wheelSettings.ts';

type WheelContent =
  | { kind: 'menu'; items: readonly MenuNode[]; onEnter: (index: number) => void }
  | {
      kind: 'games';
      items: readonly ThemeGame[];
      tabId: string;
      onPlay: (game: ThemeGame) => void;
    };

export function HyperspinWheel({
  content,
  levelId,
  depth,
  focusIndex,
  onFocusChange,
  wheel,
  art,
  pointerName,
}: {
  content: WheelContent;
  /** Changes when the level changes: the new wheel slides in. */
  levelId: string;
  depth: number;
  focusIndex: number;
  onFocusChange: (index: number) => void;
  wheel: WheelSettings;
  art: ThemeArtApi;
  pointerName: string;
}) {
  const { t } = useTranslation();
  const slotStyle = useMemo(() => (d: number) => hyperspinSlotStyle(d, wheel), [wheel]);

  // Entering deeper slides the new wheel in from the right, going back from the left.
  const [seen, setSeen] = useState({ depth, dir: 1 as 1 | -1 });
  let dir = seen.dir;
  if (depth !== seen.depth) {
    dir = depth > seen.depth ? 1 : -1;
    setSeen({ depth, dir });
  }

  const shared = {
    focusIndex,
    onFocusChange,
    slotHeight: wheel.itemHeight,
    spacing: wheel.spacing,
    slotStyle,
    className: 'hs-wheel',
  };

  return (
    <>
      {/* Entrance only: the old wheel is replaced at once, the new one slides in. */}
      <motion.div
        key={levelId}
        initial={{ x: 80 * dir, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={dir > 0 ? levelPush : levelPop}
        className="absolute inset-0"
      >
        {content.kind === 'games' ? (
          <VerticalWheel
            key={content.tabId}
            {...shared}
            items={content.items}
            onActivate={(i) => {
              const game = content.items[i];
              if (game) content.onPlay(game);
            }}
            renderItem={({ item, focused }) => (
              <WheelItem
                candidates={[art.gameMedia(item, 'logo-clear')].filter((u): u is string => !!u)}
                label={item.title}
                focused={focused}
              />
            )}
          />
        ) : (
          <VerticalWheel
            {...shared}
            items={content.items}
            onActivate={content.onEnter}
            renderItem={({ item, focused }) => (
              <WheelItem
                candidates={art.logo(item.name)}
                label={nodeLabel(item, t)}
                focused={focused}
              />
            )}
          />
        )}
      </motion.div>
      {/* The focus is always at the vertical center, so the pointer never moves; on a game list
          it shows the system's pointer while games scroll. */}
      <HyperspinPointer
        name={pointerName}
        candidates={art.pointer(pointerName)}
        height={wheel.pointerHeight}
      />
    </>
  );
}
