// Ported from NextLevelOS src/themes/big-box-list/systemNode.ts @ 3d530b7, on MenuNodes.
import type { MenuNode } from '@nextlevel/shared';
import type { Level } from '../engine/types.ts';

/**
 * The menu node that names a games level: the nearest system node from the top of the stack
 * down (so a filter leaf like "Official" resolves to its system), else the current level's own
 * node (e.g. a collection).
 */
export function systemNodeFor(stack: readonly Level[]): MenuNode | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const node = stack[i]?.node;
    if (node?.type === 'system') return node;
  }
  return stack.at(-1)?.node ?? null;
}

/** Title and badge (the short name, uppercased) for the games header. */
export function gamesHeader(
  node: MenuNode | null,
  label: (node: MenuNode) => string,
): { title: string; badge: string | null } {
  if (!node) return { title: '', badge: null };
  return { title: label(node), badge: node.shortName ? node.shortName.toUpperCase() : null };
}
