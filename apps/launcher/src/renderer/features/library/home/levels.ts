import type {
  CollectionSummary,
  GameScope,
  MenuNode,
  MenuTree,
  SmartFilterSummary,
  SystemDefinition,
  SystemSummary,
} from '@nextlevel/shared';

/** Path ids of the two fixed levels after the menu's own items (D61). */
export const NOT_IN_MENU_LEVEL = '@notInMenu';
export const COLLECTIONS_LEVEL = '@collections';

export type HomeCardKind =
  'category' | 'system' | 'collection' | 'smartFilter' | 'notInMenu' | 'collections';

/** One card of a home level: a level to open, or a scope whose games to show. */
export interface HomeCard {
  key: string;
  label: string;
  /** Items in a level, games in a scope. */
  count: number;
  kind: HomeCardKind;
  scope?: GameScope;
}

export interface HomeContext {
  systems: readonly SystemSummary[];
  catalog: readonly SystemDefinition[];
  collections: readonly CollectionSummary[];
  smartFilters: readonly SmartFilterSummary[];
  /** The fixed levels' names, translated. */
  labels: { notInMenu: string; collections: string };
}

export interface HomeLevel {
  /** The path that exists: an id that no longer does cuts it there. */
  path: string[];
  title: string;
  trail: Array<{ id: string; label: string }>;
  cards: HomeCard[];
}

function nodeCard(node: MenuNode, ctx: HomeContext): HomeCard | null {
  const base = { key: node.id, label: node.display };
  switch (node.type) {
    case 'category':
      return { ...base, count: node.children.length, kind: 'category' };
    case 'system': {
      const systemId = node.systemId ?? '';
      const games = ctx.systems.find((s) => s.id === systemId)?.games ?? 0;
      return { ...base, count: games, kind: 'system', scope: { kind: 'system', systemId } };
    }
    case 'collection': {
      const collectionId = node.collectionId ?? 0;
      const games = ctx.collections.find((c) => c.id === collectionId)?.games ?? 0;
      return {
        ...base,
        count: games,
        kind: 'collection',
        scope: { kind: 'collection', collectionId },
      };
    }
    case 'smartFilter': {
      const smartFilterId = node.smartFilterId ?? 0;
      const games = ctx.smartFilters.find((f) => f.id === smartFilterId)?.games ?? 0;
      return {
        ...base,
        count: games,
        kind: 'smartFilter',
        scope: { kind: 'smartFilter', smartFilterId },
      };
    }
    case 'filter':
      return null;
  }
}

function* systemIds(nodes: readonly MenuNode[]): Generator<string> {
  for (const node of nodes) {
    if (node.type === 'system' && node.systemId) yield node.systemId;
    if (node.type === 'category') yield* systemIds(node.children);
  }
}

/** Systems with games the menu doesn't show (left out, hidden or disabled), by name. */
function notInMenuCards(tree: MenuTree, ctx: HomeContext): HomeCard[] {
  const placed = new Set(systemIds(tree.items));
  const name = (id: string) => ctx.catalog.find((s) => s.id === id)?.name ?? id;
  return ctx.systems
    .filter((s) => s.games > 0 && !placed.has(s.id))
    .map((s): HomeCard => ({
      key: s.id,
      label: name(s.id),
      count: s.games,
      kind: 'system',
      scope: { kind: 'system', systemId: s.id },
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

function collectionCards(ctx: HomeContext): HomeCard[] {
  return [
    ...ctx.collections.map((c): HomeCard => ({
      key: `c:${String(c.id)}`,
      label: c.name,
      count: c.games,
      kind: 'collection',
      scope: { kind: 'collection', collectionId: c.id },
    })),
    ...ctx.smartFilters.map((f): HomeCard => ({
      key: `sf:${String(f.id)}`,
      label: f.name,
      count: f.games,
      kind: 'smartFilter',
      scope: { kind: 'smartFilter', smartFilterId: f.id },
    })),
  ];
}

/**
 * The home level at `path` (D61): the active menu's items one level at a time, and at the root
 * two fixed levels: Not in menu (only when it has systems) and Collections. A path id that no
 * longer names a category of the level above cuts the path there.
 */
export function levelAt(tree: MenuTree, path: readonly string[], ctx: HomeContext): HomeLevel {
  const notInMenu = notInMenuCards(tree, ctx);
  const [first] = path;
  if (first === NOT_IN_MENU_LEVEL && notInMenu.length > 0) {
    const trail = [{ id: first, label: ctx.labels.notInMenu }];
    return { path: [first], title: ctx.labels.notInMenu, trail, cards: notInMenu };
  }
  if (first === COLLECTIONS_LEVEL) {
    const trail = [{ id: first, label: ctx.labels.collections }];
    return { path: [first], title: ctx.labels.collections, trail, cards: collectionCards(ctx) };
  }
  let items = tree.items;
  const trail: HomeLevel['trail'] = [];
  for (const id of path) {
    const node = items.find((item) => item.id === id && item.type === 'category');
    if (!node) break;
    trail.push({ id, label: node.display });
    items = node.children;
  }
  const cards = items.map((node) => nodeCard(node, ctx)).filter((card) => card !== null);
  if (trail.length === 0) {
    if (notInMenu.length > 0) {
      cards.push({
        key: NOT_IN_MENU_LEVEL,
        label: ctx.labels.notInMenu,
        count: notInMenu.length,
        kind: 'notInMenu',
      });
    }
    cards.push({
      key: COLLECTIONS_LEVEL,
      label: ctx.labels.collections,
      count: ctx.collections.length + ctx.smartFilters.length,
      kind: 'collections',
    });
  }
  return {
    path: trail.map((step) => step.id),
    title: trail.at(-1)?.label ?? tree.title,
    trail,
    cards,
  };
}
