import type { GameFlags } from '@nextlevel/shared';
import { FolderMinus, FolderPlus, ImageDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollectionDialogs, type CollectionDialogState } from './CollectionDialog.tsx';
import { useRemoveFromCollection } from './collectionsApi.ts';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
import { GameContextMenu, type MenuItem } from './GameContextMenu.tsx';
import { LaunchOptionsDialog } from './LaunchOptionsDialog.tsx';
import { BatchRulesDialog } from '../scrape/BatchRulesDialog.tsx';
import { useBatchOverlay } from '../scrape/useBatchOverlay.ts';
import { ScrapeDialog } from '../scrape/ScrapeDialog.tsx';
import { RelinkDialog } from './RelinkDialog.tsx';
import { SmartFilterDialogs, type SmartFilterDialogState } from './SmartFilterDialog.tsx';
import type { LibraryView } from './useLibraryView.ts';

/** Which menu or dialog is open over the Library. */
export function useOverlays() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [relinking, setRelinking] = useState<number | null>(null);
  const [launchOptions, setLaunchOptions] = useState<number | null>(null);
  const [scraping, setScraping] = useState<number | null>(null);
  const batch = useBatchOverlay();
  const [collection, setCollection] = useState<CollectionDialogState | null>(null);
  const [smartFilter, setSmartFilter] = useState<SmartFilterDialogState | null>(null);
  return {
    menu,
    editing,
    relinking,
    launchOptions,
    scraping,
    collection,
    smartFilter,
    openMenu: setMenu,
    edit: setEditing,
    relink: setRelinking,
    openLaunchOptions: setLaunchOptions,
    scrape: setScraping,
    openCollection: setCollection,
    openSmartFilter: setSmartFilter,
    closeMenu: () => {
      setMenu(null);
    },
    closeEdit: () => {
      setEditing(null);
    },
    closeRelink: () => {
      setRelinking(null);
    },
    closeLaunchOptions: () => {
      setLaunchOptions(null);
    },
    closeScrape: () => {
      setScraping(null);
    },
    ...batch,
    closeCollection: () => {
      setCollection(null);
    },
    closeSmartFilter: () => {
      setSmartFilter(null);
    },
  };
}

export type Overlays = ReturnType<typeof useOverlays>;

interface LibraryOverlaysProps {
  view: LibraryView;
  overlays: Overlays;
  onFlags: (flags: GameFlags) => void;
  /** Play, when a game may start now (D4: one at a time). */
  onPlay?: (gameId: number) => void;
  /** Where focus goes back when the context menu closes. */
  onMenuClosed: () => void;
}

/** The context menu and dialogs of the Library (S7). */
export function LibraryOverlays(props: LibraryOverlaysProps) {
  const { view, overlays, onFlags, onMenuClosed } = props;
  const { t } = useTranslation();
  const removeFromCollection = useRemoveFromCollection();
  const targets = overlays.menu ? view.selectedGames() : [];
  const ids = overlays.menu ? [...view.selection.ids] : [];
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
  const [onlyId] = ids;
  const editItems: MenuItem[] =
    ids.length === 1 && onlyId !== undefined
      ? [
          {
            key: 'scrape',
            label: t('library.menu.scrape'),
            icon: ImageDown,
            run: () => {
              overlays.scrape(onlyId);
            },
          },
        ]
      : [];
  if (ids.length > 1 && overlays.canBatch) {
    collectionItems.push(overlays.batchItem(ids));
  }
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
      {overlays.menu && ids.length > 0 && (
        <GameContextMenu
          gameIds={ids}
          games={targets}
          point={overlays.menu}
          onClose={() => {
            overlays.closeMenu();
            onMenuClosed();
          }}
          onEdit={overlays.edit}
          onLaunchOptions={overlays.openLaunchOptions}
          {...(props.onPlay ? { onPlay: props.onPlay } : {})}
          onMissingReason={overlays.relink}
          onFlags={onFlags}
          extraItems={collectionItems}
          editItems={editItems}
        />
      )}
      {overlays.collection && (
        <CollectionDialogs
          state={overlays.collection}
          onClose={overlays.closeCollection}
          onDeleted={view.resetScope}
        />
      )}
      {overlays.smartFilter && (
        <SmartFilterDialogs
          state={overlays.smartFilter}
          systems={enabledSystems(view)}
          onClose={overlays.closeSmartFilter}
          onDeleted={view.resetScope}
        />
      )}
      {overlays.editing !== null && (
        <EditMetadataDialog gameId={overlays.editing} onClose={overlays.closeEdit} />
      )}
      {overlays.relinking !== null && (
        <RelinkDialog gameId={overlays.relinking} onClose={overlays.closeRelink} />
      )}
      {overlays.batchRules && (
        <BatchRulesDialog {...overlays.batchRules} onClose={overlays.closeBatch} />
      )}
      {overlays.scraping !== null && (
        <ScrapeDialog gameId={overlays.scraping} onClose={overlays.closeScrape} />
      )}
      {overlays.launchOptions !== null && (
        <LaunchOptionsDialog
          gameId={overlays.launchOptions}
          onClose={overlays.closeLaunchOptions}
        />
      )}
    </>
  );
}

/** Enabled systems by name, for limiting a smart filter to some of them. */
function enabledSystems(view: LibraryView) {
  const names = new Map((view.catalog.data ?? []).map((system) => [system.id, system.name]));
  return (view.systems.data ?? [])
    .filter((system) => system.enabled)
    .map((system) => ({ id: system.id, name: names.get(system.id) ?? system.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
