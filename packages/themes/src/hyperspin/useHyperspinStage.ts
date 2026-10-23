// What HyperSpin's stage shows: the settled wheel item (only it animates in; a new level shows its
// first item at once), the level's count or message.
import { gameById } from '../engine/gameIndex.ts';
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { useTranslation } from 'react-i18next';
import { countLabel, useGameCount } from '../components/useGameCount.ts';
import { useSettledFocus } from '../components/useSettledFocus.ts';
import { nodeLabel } from '../engine/levelModel.ts';
import type { Level } from '../engine/types.ts';
import { useThemeArt } from '../engine/useThemeArt.ts';
import type { StageItem } from './Stage.tsx';
import { gameStageItem, menuStageItem } from './stageItem.ts';

export function useHyperspinStage({
  level,
  depth,
  menuItems,
  focusedMenuItem,
  display,
  focusedGame,
  filtersAsGames,
}: {
  level: Level | null;
  depth: number;
  menuItems: readonly MenuNode[];
  focusedMenuItem: MenuNode | null;
  display: readonly ThemeGame[];
  focusedGame: ThemeGame | null;
  filtersAsGames: boolean;
}): { levelId: string; item: StageItem | null; message: string | null; countText: string } {
  const { t } = useTranslation();
  const art = useThemeArt();
  const prefix = `${String(depth)}:`;
  const levelId = level ? `${level.kind}:${prefix}${level.node?.id ?? 'root'}` : 'none';
  const focusId =
    level?.kind === 'games'
      ? focusedGame
        ? prefix + String(focusedGame.id)
        : ''
      : focusedMenuItem
        ? prefix + focusedMenuItem.id
        : '';
  const settledId = useSettledFocus(focusId, 250, levelId);
  const settledMenuItem =
    level?.kind === 'menu' ? menuItems.find((m) => prefix + m.id === settledId) : undefined;
  // One id → index map per list, not a scan of the list per settle (10k-game levels).
  const settledGame =
    level?.kind === 'games' && settledId.startsWith(prefix)
      ? gameById(display, Number(settledId.slice(prefix.length)))
      : undefined;
  // The count follows the settled item (already debounced), so no second delay.
  const count = useGameCount(settledMenuItem ?? null, 0, { filtersAsGames });

  let message: string | null = null;
  if (level?.kind === 'games') {
    if (level.loading) message = t('themes.common.loading');
    else if (level.error)
      message = t('themes.common.levelFailed', { name: nodeLabel(level.node, t) });
    else if (display.length === 0) message = t('themes.common.noGames');
  }
  const countText =
    level?.kind === 'games'
      ? message
        ? ''
        : t('themes.count.games', { count: display.length })
      : countLabel(count, t);
  const item = settledGame
    ? gameStageItem(art, settledId, settledGame)
    : settledMenuItem
      ? menuStageItem(art, settledId, settledMenuItem, nodeLabel(settledMenuItem, t))
      : null;
  return { levelId, item, message, countText };
}
