// Ported from NextLevelOS src/themes/components/useGameCount.ts @ 3d530b7: counts come from the
// host's game lists (cached per node until the library changes) instead of gamelist JSON.
import type { MenuNode } from '@nextlevel/shared';
import { useEffect, useState } from 'react';
import { countGames } from '../engine/gameCount.ts';
import { hasOnlyFilterChildren, levelKind } from '../engine/levelModel.ts';
import { useThemeHost } from '../engine/useThemeNavigation.ts';
import type { ThemeHost } from '../host/ThemeHost.ts';

export type GameCountState =
  | { kind: 'games'; count: number | null; loading: boolean }
  | { kind: 'items'; count: number }
  | null;

interface CountEntry {
  promise: Promise<void>;
  settled: boolean;
  /** Null when the host could not list the node. */
  value: number | null;
}

/** Visible-game counts per host and node id; dropped when the host reports a library change. */
const counts = new WeakMap<ThemeHost, Map<string, CountEntry>>();

function loadCount(host: ThemeHost, nodeId: string): CountEntry {
  let byNode = counts.get(host);
  if (!byNode) {
    byNode = new Map();
    counts.set(host, byNode);
  }
  const existing = byNode.get(nodeId);
  if (existing) return existing;
  const entry: CountEntry = { promise: Promise.resolve(), settled: false, value: null };
  entry.promise = host.getGames(nodeId).then(
    (games) => {
      entry.value = countGames(games);
      entry.settled = true;
    },
    () => {
      entry.settled = true;
    },
  );
  byNode.set(nodeId, entry);
  return entry;
}

/** "N games" / "N items" / "…" for a count; '' when unknown. */
export function countLabel(
  count: GameCountState,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!count) return '';
  if (count.kind === 'items') return t('themes.count.items', { count: count.count });
  if (count.loading) return '…';
  if (count.count === null) return '';
  return t('themes.count.games', { count: count.count });
}

/**
 * The count to show for a focused menu node: its children for a menu node, or (once it stayed
 * focused for `settleMs`) its visible games for a system, filter or collection. A count already
 * known shows at once. With `filtersAsGames` (themes that show filters as game-list tabs) a
 * system whose children are all filters counts as games.
 */
export function useGameCount(
  node: MenuNode | null,
  settleMs = 250,
  opts: { filtersAsGames?: boolean } = {},
): GameCountState {
  const host = useThemeHost();
  const isGames =
    !!node &&
    (levelKind(node) === 'games' || (!!opts.filtersAsGames && hasOnlyFilterChildren(node)));
  const key = isGames ? node.id : '';
  // Bumped when a load settles or the library changes, to re-read the cache.
  const [revision, setRevision] = useState(0);

  useEffect(
    () =>
      host.onEvent((event) => {
        if (event.type !== 'library-changed') return;
        counts.delete(host);
        setRevision((n) => n + 1);
      }),
    [host],
  );

  useEffect(() => {
    if (!key || counts.get(host)?.get(key)?.settled) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void loadCount(host, key).promise.then(() => {
        if (!cancelled) setRevision((n) => n + 1);
      });
    }, settleMs);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [host, key, revision, settleMs]);

  if (!node) return null;
  if (!isGames) return { kind: 'items', count: node.children.length };
  const known = counts.get(host)?.get(key);
  if (known?.settled) return { kind: 'games', count: known.value, loading: false };
  return { kind: 'games', count: null, loading: true };
}
