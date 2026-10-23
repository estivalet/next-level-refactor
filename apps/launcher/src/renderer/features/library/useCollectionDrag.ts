import type { CollectionSummary } from '@nextlevel/shared';
import { useMoveInCollection } from './collectionsApi.ts';
import type { LibraryView } from './useLibraryView.ts';
import type { RowReorder } from './useRowDrag.ts';

/**
 * Drag reorder for the collection shown, only while it is in manual order (FR-LIB-8, D11). A
 * drag from a selected row moves the whole selection — also rows on pages never loaded (a Shift
 * range fetches every id); main keeps them in their collection order.
 */
export function useCollectionDrag(
  view: LibraryView,
  collection: CollectionSummary | undefined,
): RowReorder | undefined {
  const move = useMoveInCollection();
  if (!collection || collection.sort !== 'manual') return undefined;
  return {
    blockFor: (index) => {
      const id = view.games.rowAt(index)?.id;
      if (id === undefined) return [];
      return view.selection.ids.has(id) ? [...view.selection.ids] : [id];
    },
    onMove: (gameIds, beforeGameId) => {
      move.mutate({ id: collection.id, gameIds, beforeGameId });
    },
  };
}
