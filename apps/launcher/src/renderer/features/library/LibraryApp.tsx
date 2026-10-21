import type { GameFlags } from '@nextlevel/shared';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { FolderMinus, FolderPlus } from 'lucide-react';
import { CollectionDialogs, type CollectionDialogState } from './CollectionDialog.tsx';
import { CollectionToolbar, NewCollectionButton } from './CollectionToolbar.tsx';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
import { GameContextMenu, type MenuItem } from './GameContextMenu.tsx';
import { useRemoveFromCollection } from './collectionsApi.ts';
import { GameDetails } from './GameDetails.tsx';
import { GameList } from './GameList.tsx';
import { LibraryEmpty, LibraryUnavailable } from './LibraryEmpty.tsx';
import { LibraryStatusBar } from './LibraryStatusBar.tsx';
import { useLibraryEvents } from './libraryApi.ts';
import { RelinkDialog } from './RelinkDialog.tsx';
import { SystemTree } from './SystemTree.tsx';
import { leavesTab, scopeFacts } from './scopeFacts.ts';
import { useLibraryView } from './useLibraryView.ts';

/** The Game Library app (S7): system tree, virtualized game list, details panel, status bar. */
export function LibraryApp() {
  const { t } = useTranslation();
  useLibraryEvents();
  const view = useLibraryView();
  const list = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [relinking, setRelinking] = useState<number | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<CollectionDialogState | null>(null);
  const removeFromCollection = useRemoveFromCollection();
  const { setRange } = view;
  const onRange = useCallback(
    (first: number, last: number) => {
      setRange(first, last);
    },
    [setRange],
  );
  const systemName = (id: string) => view.catalog.data?.find((s) => s.id === id)?.name ?? id;

  if (errorCode(view.systems.error) === 'LIBRARY_UNAVAILABLE') return <LibraryUnavailable />;
  if (view.systems.isPending || view.collections.isPending) {
    return <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>;
  }
  if (!view.scope) return <LibraryEmpty />;

  const facts = scopeFacts(view);
  const targets = menu ? view.selectedGames() : [];
  const scope = view.scope;
  const collection =
    scope.kind === 'collection'
      ? view.collections.data?.find((c) => c.id === scope.collectionId)
      : undefined;
  const collectionItems: MenuItem[] = [
    {
      key: 'add',
      label: t('library.collections.add'),
      icon: FolderPlus,
      run: () => {
        setCollectionDialog({ kind: 'add', gameIds: targets.map((game) => game.id) });
      },
    },
  ];
  if (collection) {
    collectionItems.push({
      key: 'remove',
      label: t('library.collections.remove'),
      icon: FolderMinus,
      run: () => {
        removeFromCollection.mutate({ id: collection.id, gameIds: targets.map((game) => game.id) });
        view.focusRow(Math.min(view.focused, view.selection.anchor ?? view.focused));
      },
    });
  }
  const onFlags = (flags: GameFlags) => {
    if (!leavesTab(view.tab, flags)) return;
    // The next row moves up into place: keep the focus on the top of the selection.
    view.focusRow(Math.min(view.focused, view.selection.anchor ?? view.focused));
  };

  return (
    <div className="relative flex h-full flex-col bg-[#0b0b0f] text-slate-300">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#111115]">
          <SystemTree
            rows={view.tree}
            scope={view.scope}
            onSelectScope={view.setScope}
            onToggleGroup={view.toggleGroup}
            collectionsAction={
              <NewCollectionButton
                onClick={() => {
                  setCollectionDialog({ kind: 'new' });
                }}
              />
            }
          />
        </aside>
        <main ref={list} className="flex min-w-0 flex-1 flex-col">
          {collection && (
            <CollectionToolbar
              collection={collection}
              focused={
                view.focusedGame ? { index: view.focused, gameId: view.focusedGame.id } : null
              }
              total={view.games.total ?? 0}
              onMoved={view.focusRow}
              onRename={() => {
                setCollectionDialog({ kind: 'rename', collection });
              }}
              onDelete={() => {
                setCollectionDialog({ kind: 'delete', collection });
              }}
            />
          )}
          <GameList
            games={view.games}
            selection={view.selection}
            focused={view.focused}
            onSelect={view.selectRow}
            onRange={onRange}
            onOpenMenu={(_index, point) => {
              setMenu(point);
            }}
          />
        </main>
        <aside
          aria-label={t('library.details.label')}
          className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-white/5 bg-[#111115]"
        >
          <GameDetails
            gameId={view.focusedGame?.id ?? null}
            systemName={systemName}
            onEdit={setEditing}
            onRelink={setRelinking}
            onFlags={onFlags}
          />
        </aside>
      </div>
      <LibraryStatusBar
        games={facts.games}
        missing={facts.missing}
        tab={view.tab}
        onTab={view.setTab}
        {...(view.scope.kind === 'system' ? { sort: view.sort, onSort: view.setSort } : {})}
        scopeName={
          facts.name ?? systemName(view.scope.kind === 'system' ? view.scope.systemId : '')
        }
      />
      {menu && targets.length > 0 && (
        <GameContextMenu
          games={targets}
          point={menu}
          onClose={() => {
            setMenu(null);
            list.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
          }}
          onEdit={setEditing}
          onMissingReason={setRelinking}
          onFlags={onFlags}
          extraItems={collectionItems}
        />
      )}
      {collectionDialog && (
        <CollectionDialogs
          state={collectionDialog}
          onClose={() => {
            setCollectionDialog(null);
          }}
          onDeleted={view.resetScope}
        />
      )}
      {editing !== null && (
        <EditMetadataDialog
          gameId={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {relinking !== null && (
        <RelinkDialog
          gameId={relinking}
          onClose={() => {
            setRelinking(null);
          }}
        />
      )}
    </div>
  );
}
