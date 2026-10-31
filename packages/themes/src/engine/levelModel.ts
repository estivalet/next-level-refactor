// Ported from NextLevelOS src/themes/engine/levelModel.ts @ 3d530b7. Nodes are MenuNodes; a filter
// is a node of its own (with its own id), so filter levels load like any other game level.
import type { MenuNode } from '@nextlevel/shared';
import type { EnterOptions, Level } from './types.ts';

/** A node with children is a menu; systems without filters, filters and collections are games. */
export function levelKind(node: MenuNode): 'menu' | 'games' {
  if (node.type === 'category') return 'menu';
  return node.children.length > 0 ? 'menu' : 'games';
}

/** True when `node` has children and every one is a filter. */
export function hasOnlyFilterChildren(node: MenuNode): boolean {
  return node.children.length > 0 && node.children.every((child) => child.type === 'filter');
}

/** The nearest system in `[...ancestors, node]` (root → node), or null (a collection). */
export function findSystemId(ancestors: readonly MenuNode[], node: MenuNode): string | null {
  const chain = [...ancestors, node];
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const systemId = chain[i]?.systemId;
    if (systemId) return systemId;
  }
  return null;
}

/** What a theme shows for a node: its translated label when it has one, else its display name. */
export function nodeLabel(node: MenuNode, t: (key: string) => string): string {
  return node.labelKey ? t(node.labelKey) : node.display;
}

/**
 * Names to look a node's logo up by, in order. A filter carries its system's name (its games
 * level shows the system's art), so its own logo, e.g. `Official.png`, is tried first.
 */
export function logoNames(node: MenuNode): string[] {
  return node.type === 'filter' && node.display !== node.name
    ? [node.display, node.name]
    : [node.name];
}

export function resolveLevel(
  node: MenuNode,
  ancestors: readonly MenuNode[],
  opts: EnterOptions = {},
): Level {
  const systemId = findSystemId(ancestors, node);
  const games = {
    kind: 'games' as const,
    node,
    systemId,
    games: [],
    loading: true,
    lastFocusIndex: 0,
  };
  if (opts.flattenFilters && hasOnlyFilterChildren(node)) {
    return { ...games, filterTabs: node.children };
  }
  if (levelKind(node) === 'menu') {
    return { kind: 'menu', node, items: node.children, title: node.display, lastFocusIndex: 0 };
  }
  return node.filter ? { ...games, filter: node.filter } : games;
}

/**
 * Rebuilds the stack for a theme that shows a system's filters the other way (`filtersInMenu`),
 * keeping the user on the same system and filter:
 * - false (tabs): a filter menu, or a filter's game list inside it, becomes the system's
 *   flattened game list with `filterTab` = the filter the user was on.
 * - true (menu): a flattened game list becomes the filter menu, focused on its `filterTab`
 *   (the first filter for All / Hidden).
 * Returns null when the stack already matches.
 */
export function reshapeFilterLevels(
  stack: readonly Level[],
  focusIndex: number,
  filtersInMenu: boolean,
): { stack: Level[]; focusIndex: number } | null {
  const ancestorsOf = (i: number) =>
    stack
      .slice(0, i)
      .map((level) => level.node)
      .filter((node): node is MenuNode => node != null);

  if (!filtersInMenu) {
    const i = stack.findIndex(
      (level, at) =>
        at > 0 && level.kind === 'menu' && !!level.node && hasOnlyFilterChildren(level.node),
    );
    const menu = stack[i];
    if (i < 0 || menu?.kind !== 'menu' || !menu.node) return null;
    const inside = stack[i + 1];
    const filterTab = inside
      ? inside.kind === 'games'
        ? inside.filter
        : undefined
      : menu.items[focusIndex]?.filter;
    const games = resolveLevel(menu.node, ancestorsOf(i), { flattenFilters: true });
    const level = filterTab === undefined ? games : ({ ...games, filterTab } as Level);
    return { stack: [...stack.slice(0, i), level], focusIndex: 0 };
  }

  const top = stack[stack.length - 1];
  if (top?.kind !== 'games' || !top.filterTabs) return null;
  const menu = resolveLevel(top.node, ancestorsOf(stack.length - 1));
  if (menu.kind !== 'menu') return null;
  const at = menu.items.findIndex((item) => !!top.filterTab && item.filter === top.filterTab);
  const focus = Math.max(0, at);
  return { stack: [...stack.slice(0, -1), { ...menu, lastFocusIndex: focus }], focusIndex: focus };
}
