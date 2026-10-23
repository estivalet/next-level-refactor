import { walkMenuNodes, type MenuDocNode } from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { findNode, insertNode } from './treeOps.ts';

/** Why a node can't open in themes; `ok` when it can (FR-MENU-2, same rules as resolveMenu). */
export type NodeStatus = 'ok' | 'systemDisabled' | 'noGames' | 'missingRef' | 'empty';

/** What menu nodes point at, as the editor knows it. `games` = present games. */
export interface MenuRefs {
  systems: ReadonlyMap<
    string,
    { name: string; manufacturer?: string | undefined; enabled: boolean; games: number }
  >;
  collections: ReadonlyMap<number, { name: string; games: number }>;
  smartFilters: ReadonlyMap<number, { name: string; games: number }>;
}

export type RefType = Exclude<MenuDocNode['type'], 'category'>;

function target(refs: MenuRefs, type: RefType, refId: string) {
  if (type === 'system') return refs.systems.get(refId);
  const id = Number(refId);
  return type === 'collection' ? refs.collections.get(id) : refs.smartFilters.get(id);
}

export function nodeStatus(node: MenuDocNode, refs: MenuRefs): NodeStatus {
  if (node.type === 'category') {
    const opens = node.children.some((child) => child.visible && nodeStatus(child, refs) === 'ok');
    return opens ? 'ok' : 'empty';
  }
  const ref = target(refs, node.type, node.refId ?? '');
  if (!ref) return 'missingRef';
  if (node.type === 'system' && !refs.systems.get(node.refId ?? '')?.enabled) {
    return 'systemDisabled';
  }
  return ref.games > 0 ? 'ok' : 'noGames';
}

/** D8: what could be in the menu but isn't — nothing is ever added on its own. */
export function notInMenu(nodes: readonly MenuDocNode[], refs: MenuRefs) {
  const used = new Set<string>();
  for (const node of walkMenuNodes(nodes)) used.add(`${node.type}:${node.refId ?? ''}`);
  const free = (type: RefType, id: string | number) => !used.has(`${type}:${String(id)}`);
  return {
    systems: [...refs.systems]
      .filter(([id, s]) => s.enabled && s.games > 0 && free('system', id))
      .map(([id, s]) => ({ id, name: s.name })),
    collections: [...refs.collections]
      .filter(([id]) => free('collection', id))
      .map(([id, c]) => ({ id, name: c.name })),
    smartFilters: [...refs.smartFilters]
      .filter(([id]) => free('smartFilter', id))
      .map(([id, f]) => ({ id, name: f.name })),
  };
}

/** A new node for a reference; its name (the art key) starts as the target's name. */
export function referenceNode(type: RefType, refId: string, refs: MenuRefs): MenuDocNode {
  return {
    id: uuidv7(),
    type,
    refId,
    name: target(refs, type, refId)?.name ?? refId,
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children: [],
  };
}

/**
 * Adds a reference (D8 "Add"): a system goes under the category named after its manufacturer
 * when the menu has one; anything else at the end of the selected category, or of the root.
 */
export function addReference(
  nodes: MenuDocNode[],
  selectedId: string | null,
  ref: { type: RefType; refId: string },
  refs: MenuRefs,
): { nodes: MenuDocNode[]; id: string } {
  const node = referenceNode(ref.type, ref.refId, refs);
  const manufacturer =
    ref.type === 'system' ? refs.systems.get(ref.refId)?.manufacturer : undefined;
  const byMaker = manufacturer
    ? [...walkMenuNodes(nodes)].find(
        (n) => n.type === 'category' && n.name.toLowerCase() === manufacturer.toLowerCase(),
      )
    : undefined;
  const selected = selectedId === null ? null : findNode(nodes, selectedId);
  const parent = byMaker ?? (selected?.type === 'category' ? selected : null);
  const index = parent ? parent.children.length : nodes.length;
  return { nodes: insertNode(nodes, parent?.id ?? null, index, node), id: node.id };
}
