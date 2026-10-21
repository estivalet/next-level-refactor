import type { GameFlags } from '@nextlevel/shared';
import { FolderMinus, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionDialogs, type CollectionDialogState } from './CollectionDialog.tsx';
import { useRemoveFromCollection } from './collectionsApi.ts';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
import { GameContextMenu, type MenuItem } from './GameContextMenu.tsx';
import { RelinkDialog } from './RelinkDialog.tsx';
import type { LibraryView } from './useLibraryView.ts';

/** Which menu or dialog is open over the Library. */
export function useOverlays() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [relinking, setRelinking] = useState<number | null>(null);
  const [collection, setCollection] = useState<CollectionDialogState | null>(null);
  return {
    menu,
    editing,
    relinking,
    collection,
    openMenu: setMenu,
    edit: setEditing,
    relink: setRelinking,
    openCollection: setCollection,
    closeMenu: () => {
      setMenu(null);
    },
    closeEdit: () => {
      setEditing(null);
    },
    closeRelink: () => {
      setRelinking(null);
    },
    closeCollection: () => {
      setCollection(null);
    },
  };
}

export type Overlays = ReturnType<typeof useOverlays>;

interface LibraryOverlaysProps {
  view: LibraryView;
  overlays: Overlays;
  onFlags: (flags: GameFlags) => void;
  /** Where focus goes back when the context menu closes. */
  onMenuClosed: () => void;
}

/** The context menu and dialogs of the Library (S7). */
export function LibraryOverlays({ view, overlays, onFlags, onMenuClosed }: LibraryOverlaysProps) {
  const { t } = useTranslation();
  const removeFromCollection = useRemoveFromCollection();
  const targets = overlays.menu ? view.selectedGames() : [];
  const ids = targets.map((game) => game.id);
  const scope = view.scope;
  const shown =
    scope?.kind === 'collection'
      ? view.collections.data?.find((c) => c.id === scope.collectionId)
      : undefined;
  const collectionItems: MenuItem[] = [
    {
      key: 'add',
      label: t('library.collections.add'),
      icon: FolderPlus,
      run: () => {
        overlays.openCollection({ kind: 'add', gameIds: ids });
      },
    },
  ];
  if (shown) {
    collectionItems.push({
      key: 'remove',
      label: t('library.collections.remove'),
      icon: FolderMinus,
      run: () => {
        removeFromCollection.mutate({ id: shown.id, gameIds: ids });
        view.focusRow(Math.min(view.focused, view.selection.anchor ?? view.focused));
      },
    });
  }

  return (
    <>
      {overlays.menu && targets.length > 0 && (
        <GameContextMenu
          games={targets}
          point={overlays.menu}
          onClose={() => {
            overlays.closeMenu();
            onMenuClosed();
          }}
          onEdit={overlays.edit}
          onMissingReason={overlays.relink}
          onFlags={onFlags}
          extraItems={collectionItems}
        />
      )}
      {overlays.collection && (
        <CollectionDialogs
          state={overlays.collection}
          onClose={overlays.closeCollection}
          onDeleted={view.resetScope}
        />
      )}
      {overlays.editing !== null && (
        <EditMetadataDialog gameId={overlays.editing} onClose={overlays.closeEdit} />
      )}
      {overlays.relinking !== null && (
        <RelinkDialog gameId={overlays.relinking} onClose={overlays.closeRelink} />
      )}
    </>
  );
}
