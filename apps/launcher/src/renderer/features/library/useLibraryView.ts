import type { GameScope, GameSort, GameTab } from '@nextlevel/shared';
import { useMemo, useState } from 'react';
import { useSystemCatalog } from '../settings/settingsApi.ts';
import { buildTree } from './buildTree.ts';
import { useCollections } from './collectionsApi.ts';
import { useSystemSummaries } from './libraryApi.ts';
import { EMPTY_SELECTION, select, type SelectMode } from './selection.ts';
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
  const nothing = { selection: EMPTY_SELECTION, focused: -1, focusedId: null as number | null };
  const [picked, setPicked] = useState({ key: viewKey, ...nothing });
  const current = picked.key === viewKey ? picked : nothing;
  const idAt = (index: number) => games.rowAt(index)?.id;
  // Focus follows its game when a change re-sorts the list (an edited title, a new rating).
  const moved = current.focusedId === null ? -1 : games.indexOf(current.focusedId);
  const wanted = moved >= 0 ? moved : current.focused;
  // Rows can disappear under the focus (hidden, relinked): stay on the last row.
  const focused = games.total !== null && wanted >= games.total ? games.total - 1 : wanted;
  const focusedGame = games.rowAt(focused) ?? null;
  // With nothing picked, the focused row is the selection (after a hide, the next row).
  const selection =
    current.selection.ids.size === 0 && focusedGame
      ? { anchor: focused, ids: new Set([focusedGame.id]) }
      : current.selection;

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
    selection,
    focused,
    focusedGame,
    /** The loaded rows that are selected, in list order. */
    selectedGames: () => {
      const rows = [];
      for (let index = Math.max(0, games.firstLoaded); index < games.lastLoaded; index += 1) {
        const row = games.rowAt(index);
        if (row && selection.ids.has(row.id)) rows.push(row);
      }
      return rows;
    },
    setScope: (next: GameScope) => {
      setScope(next);
    },
    /** Back to the first system, e.g. after the shown collection was deleted. */
    resetScope: () => {
      setScope(null);
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
      const { anchor } = selection;
      if (mode === 'range' && anchor !== null) {
        // The rows between may sit on pages never loaded: fetch them, then select every id.
        const [from, to] = [Math.min(anchor, index), Math.max(anchor, index)];
        void games.idsInRange(from, to).then((ids) => {
          setPicked({
            key: viewKey,
            selection: { anchor, ids: new Set(ids) },
            focused: index,
            focusedId: null,
          });
        });
        return;
      }
      setPicked({
        key: viewKey,
        selection: select(selection, index, mode, idAt),
        focused: index,
        focusedId: idAt(index) ?? null,
      });
    },
    /** Rows are about to leave the list: drop the selection, keep the focus on row `index`. */
    focusRow: (index: number) => {
      setPicked({ key: viewKey, selection: EMPTY_SELECTION, focused: index, focusedId: null });
    },
  };
}

export type LibraryView = ReturnType<typeof useLibraryView>;
