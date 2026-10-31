// Ported from NextLevelOS src/themes/components/gameTabs.ts @ 3d530b7: the tabs are All · Favorites
// · Hidden (screen spec S5), labelled through i18n; filters are menu nodes.
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { hasFilter, isFavorite, isHidden } from '../engine/gameFlags.ts';

export interface GameTab {
  id: string;
  /** An i18n key, or `label` for a name that comes with the data (a filter's display name). */
  labelKey?: string;
  label?: string;
  predicate: (game: ThemeGame) => boolean;
}

export function tabLabel(tab: GameTab, t: (key: string) => string): string {
  return tab.labelKey ? t(tab.labelKey) : (tab.label ?? tab.id);
}

const ALL: GameTab = { id: 'all', labelKey: 'themes.tabs.all', predicate: (g) => !isHidden(g) };
const FAVORITES: GameTab = {
  id: 'favorites',
  labelKey: 'themes.tabs.favorites',
  predicate: (g) => !isHidden(g) && isFavorite(g),
};
const HIDDEN: GameTab = { id: 'hidden', labelKey: 'themes.tabs.hidden', predicate: isHidden };

/** Hidden games show up only in the Hidden tab, as in the Library. */
export const DEFAULT_GAME_TABS: readonly GameTab[] = [ALL, FAVORITES, HIDDEN];

export function countTabs(
  games: readonly ThemeGame[],
  tabs: readonly GameTab[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tab of tabs) out[tab.id] = 0;
  for (const game of games) {
    for (const tab of tabs) if (tab.predicate(game)) out[tab.id] = (out[tab.id] ?? 0) + 1;
  }
  return out;
}

/**
 * Tabs for a system's filter nodes: Official first, the other filters in menu order, then All
 * and Hidden. Opens on Official, else All. A filter tab holds the non-hidden games carrying it.
 */
export function buildFilterTabs(filters: readonly MenuNode[]): {
  tabs: GameTab[];
  defaultTabId: string;
} {
  const seen = new Set<string>();
  const unique = filters.filter((node) => {
    if (!node.filter || seen.has(node.filter)) return false;
    seen.add(node.filter);
    return true;
  });
  const official = unique.find((node) => node.filter === 'official');
  const ordered = official ? [official, ...unique.filter((node) => node !== official)] : unique;
  const toTab = (node: MenuNode): GameTab => {
    const slug = node.filter ?? '';
    return {
      id: `filter:${slug}`,
      ...(node.labelKey ? { labelKey: node.labelKey } : { label: node.display || node.name }),
      predicate: (g) => !isHidden(g) && hasFilter(g, slug),
    };
  };
  return {
    tabs: [...ordered.map(toTab), ALL, HIDDEN],
    defaultTabId: official ? 'filter:official' : 'all',
  };
}
