import type { MenuDocNode, MenuDraft, MenuNode, MenuTree } from '@nextlevel/shared';
import { filterNodes } from '../frontend/menuTree.ts';

/** What a stored menu is resolved against: the catalog, settings and the library, as of now. */
export interface ResolveContext {
  systems: ReadonlyMap<string, { name: string; shortName?: string | undefined }>;
  enabled: ReadonlySet<string>;
  /** Present (non-missing) games per system id. */
  gameCounts: ReadonlyMap<string, number>;
  filtersBySystem: ReadonlyMap<string, readonly string[]>;
  collections: ReadonlyMap<number, { name: string; games: number }>;
  smartFilters: ReadonlyMap<number, { name: string; games: number }>;
}

const REF_PREFIX = { system: 's', collection: 'c', smartFilter: 'sf' } as const;

/**
 * Turns a menu document into the tree themes read (FR-MENU-1..4). Leaves out what can't open:
 * invisible nodes and their subtrees, systems that are disabled, unknown or without present
 * games, deleted or empty collections and smart filters, and categories left empty. A reference
 * that repeats gets `~2`, `~3`… in document order so every id is unique.
 */
export function resolveMenu(draft: MenuDraft, ctx: ResolveContext): MenuTree {
  const seen = new Map<string, number>();
  const uniqueId = (base: string) => {
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}~${String(count)}`;
  };

  const resolve = (node: MenuDocNode): MenuNode | null => {
    if (!node.visible) return null;
    const labels = {
      name: node.name,
      ...(node.shortName ? { shortName: node.shortName } : {}),
    };
    switch (node.type) {
      case 'category': {
        const children = node.children.map(resolve).filter((child) => child !== null);
        if (children.length === 0) return null;
        return {
          id: `m:${node.id}`,
          ...labels,
          display: node.displayName ?? node.name,
          type: 'category',
          children,
        };
      }
      case 'system': {
        const systemId = node.refId ?? '';
        const system = ctx.systems.get(systemId);
        if (!system || !ctx.enabled.has(systemId) || !(ctx.gameCounts.get(systemId) ?? 0)) {
          return null;
        }
        const id = uniqueId(`${REF_PREFIX.system}:${systemId}`);
        const shortName = node.shortName ?? system.shortName;
        return {
          id,
          ...labels,
          ...(shortName ? { shortName } : {}),
          display: node.displayName ?? system.name,
          type: 'system',
          systemId,
          children: node.filterTabs
            ? filterNodes(
                { id: systemId, name: node.name },
                ctx.filtersBySystem.get(systemId) ?? [],
                id,
              )
            : [],
        };
      }
      case 'collection':
      case 'smartFilter': {
        const refId = Number(node.refId);
        const target =
          node.type === 'collection' ? ctx.collections.get(refId) : ctx.smartFilters.get(refId);
        if (!target || target.games === 0) return null;
        return {
          id: uniqueId(`${REF_PREFIX[node.type]}:${String(refId)}`),
          ...labels,
          display: node.displayName ?? target.name,
          type: node.type,
          ...(node.type === 'collection' ? { collectionId: refId } : { smartFilterId: refId }),
          children: [],
        };
      }
    }
  };

  return {
    title: draft.title,
    items: draft.nodes.map(resolve).filter((node) => node !== null),
  };
}
