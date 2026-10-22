import type { MenuNode } from '@nextlevel/shared';
import { findSystemId, hasOnlyFilterChildren, levelKind, resolveLevel } from './levelModel.ts';
import type { EngineState, Level } from './types.ts';

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length - 1));

/** A level rebuilt from its node in the new tree (a filter menu whose filters went is games). */
function rebuild(old: Level, node: MenuNode, parents: readonly MenuNode[]): Level {
  if (old.kind === 'menu') {
    if (levelKind(node) !== 'menu') return resolveLevel(node, parents);
    return { kind: 'menu', node, items: node.children, title: node.display, lastFocusIndex: 0 };
  }
  const next: Level = { ...old, node, systemId: findSystemId(parents, node) };
  if (!old.filterTabs) return next;
  if (hasOnlyFilterChildren(node)) {
    next.filterTabs = node.children;
    if (!node.children.some((tab) => tab.filter === old.filterTab)) delete next.filterTab;
  } else {
    delete next.filterTabs;
    delete next.filterTab;
  }
  return next;
}

/**
 * The stack after the host's menu changed (US-D5): walks the open path by node id through the new
 * tree and keeps the deepest level that still exists. Every menu level keeps focus on the same
 * node id (or its old index, clamped); an open games level keeps its games and focus.
 */
export function reloadStack(state: EngineState, items: MenuNode[], title: string): EngineState {
  const old = state.stack;
  const focusOf = (i: number) =>
    i === old.length - 1 ? state.focusIndex : (old[i]?.lastFocusIndex ?? 0);
  const stack: Level[] = [{ kind: 'menu', node: null, items, title, lastFocusIndex: 0 }];
  const parents: MenuNode[] = [];
  for (let i = 1; i < old.length; i += 1) {
    const previous = old[i];
    const parent = stack[i - 1];
    if (!previous?.node || parent?.kind !== 'menu') break;
    const id = previous.node.id;
    const node = parent.items.find((item) => item.id === id);
    if (!node) break;
    const level = rebuild(previous, node, parents);
    stack.push(level);
    parents.push(node);
    if (level.kind !== previous.kind) break;
  }

  const last = stack.length - 1;
  const focused = stack.map((level, i) => {
    const below = stack[i + 1];
    if (level.kind === 'games') {
      return i === old.length - 1 && old[i]?.kind === 'games'
        ? clamp(focusOf(i), level.games.length)
        : 0;
    }
    if (below?.node) return level.items.findIndex((item) => item.id === below.node?.id);
    const before = old[i];
    const id = before?.kind === 'menu' ? before.items[focusOf(i)]?.id : undefined;
    const at = level.items.findIndex((item) => item.id === id);
    return at >= 0 ? at : clamp(focusOf(i), level.items.length);
  });
  return {
    ...state,
    stack: stack.map((level, i) => ({ ...level, lastFocusIndex: focused[i] ?? 0 })),
    focusIndex: focused[last] ?? 0,
  };
}
