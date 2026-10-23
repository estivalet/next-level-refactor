import { CollectionToolbar } from './CollectionToolbar.tsx';
import type { Overlays } from './LibraryOverlays.tsx';
import { SmartFilterToolbar } from './SmartFilterToolbar.tsx';
import type { LibraryView } from './useLibraryView.ts';

/** The toolbar above the list for the collection or smart filter shown; nothing for a system. */
export function ScopeToolbar({ view, overlays }: { view: LibraryView; overlays: Overlays }) {
  const { scope } = view;
  if (scope?.kind === 'collection') {
    const collection = view.collections.data?.find((c) => c.id === scope.collectionId);
    if (!collection) return null;
    return (
      <CollectionToolbar
        collection={collection}
        focused={view.focusedGame ? { index: view.focused, gameId: view.focusedGame.id } : null}
        gameIdAt={(index) => view.games.rowAt(index)?.id}
        onMoved={view.focusRow}
        onRename={() => {
          overlays.openCollection({ kind: 'rename', collection });
        }}
        onDelete={() => {
          overlays.openCollection({ kind: 'delete', collection });
        }}
        onAddGames={() => {
          overlays.openCollection({ kind: 'addGames', collection });
        }}
      />
    );
  }
  if (scope?.kind === 'smartFilter') {
    const filter = view.smartFilters.data?.find((f) => f.id === scope.smartFilterId);
    if (!filter) return null;
    return (
      <SmartFilterToolbar
        filter={filter}
        onEdit={() => {
          overlays.openSmartFilter({ kind: 'edit', filter });
        }}
        onDelete={() => {
          overlays.openSmartFilter({ kind: 'delete', filter });
        }}
      />
    );
  }
  return null;
}
