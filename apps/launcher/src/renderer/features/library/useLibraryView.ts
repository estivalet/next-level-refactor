import type { GameScope, GameSort, GameTab } from '@nextlevel/shared';
import { useMemo, useState } from 'react';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import { buildTree } from './buildTree.ts';
import { useCollections } from './collectionsApi.ts';
import { useSystemSummaries } from './libraryApi.ts';
import { EMPTY_SELECTION, select, type SelectMode, type Selection } from './selection.ts';
import { usePagedGames, type GameListParams } from './usePagedGames.ts';

const NOTHING_VISIBLE = { first: 0, last: -1 };

/**
 * The Library's view state (S7): the tree, the chosen system or collection, tab, sort, the rows
 * in view and the selection. Selection and focus belong to one list: a new scope, tab or sort
 * starts them empty.
 */
export function useLibraryView() {
  const systems = useSystemSummaries();
  const catalog = useSystemCatalog();
  const collections = useCollections();
  const [chosenScope, setScope] = useState<GameScope | null>(null);
  const [tab, setTab] = useState<GameTab>('all');
  const [sort, setSort] = useState<GameSort>('title');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const tree = useMemo(
    () => buildTree(systems.data ?? [], catalog.data ?? [], collections.data ?? [], collapsed),
    [systems.data, catalog.data, collections.data, collapsed],
  );
  const firstSystem = tree.find((row) => row.kind === 'system');
  const scope: GameScope | null =
    chosenScope ?? (firstSystem ? { kind: 'system', systemId: firstSystem.systemId } : null);
  const params: GameListParams | null = scope
    ? { scope, tab, ...(scope.kind === 'system' ? { sort } : {}) }
    : null;
  const viewKey = JSON.stringify(params);

  const [range, setRange] = useState({ key: viewKey, ...NOTHING_VISIBLE });
  const games = usePagedGames(params, range.key === viewKey ? range : NOTHING_VISIBLE);
  const [picked, setPicked] = useState({
    key: viewKey,
    selection: EMPTY_SELECTION,
    focused: -1,
  });
  const current = picked.key === viewKey ? picked : { selection: EMPTY_SELECTION, focused: -1 };
  const idAt = (index: number) => games.rowAt(index)?.id;

  return {
    systems,
    catalog,
    collections,
    tree,
    scope,
    tab,
    sort,
    params,
    games,
    selection: current.selection,
    focused: current.focused,
    focusedGame: games.rowAt(current.focused) ?? null,
    setScope: (next: GameScope) => {
      setScope(next);
    },
    setTab,
    setSort,
    toggleGroup: (key: string) => {
      setCollapsed((previous) => {
        const next = new Set(previous);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    },
    setRange: (first: number, last: number) => {
      setRange((previous) =>
        previous.key === viewKey && previous.first === first && previous.last === last
          ? previous
          : { key: viewKey, first, last },
      );
    },
    selectRow: (index: number, mode: SelectMode) => {
      setPicked({
        key: viewKey,
        selection: select(current.selection, index, mode, idAt),
        focused: index,
      });
    },
    /** Keeps the selection on the same row index after the list changed under it. */
    replaceSelection: (selection: Selection, focused: number) => {
      setPicked({ key: viewKey, selection, focused });
    },
  };
}

export type LibraryView = ReturnType<typeof useLibraryView>;
