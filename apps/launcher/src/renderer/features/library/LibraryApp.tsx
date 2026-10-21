import type { GameFlags, GameTab } from '@nextlevel/shared';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { EditMetadataDialog } from './EditMetadataDialog.tsx';
import { GameContextMenu } from './GameContextMenu.tsx';
import { GameDetails } from './GameDetails.tsx';
import { GameList } from './GameList.tsx';
import { LibraryEmpty, LibraryUnavailable } from './LibraryEmpty.tsx';
import { LibraryStatusBar } from './LibraryStatusBar.tsx';
import { useLibraryEvents } from './libraryApi.ts';
import { RelinkDialog } from './RelinkDialog.tsx';
import { SystemTree } from './SystemTree.tsx';
import { useLibraryView, type LibraryView } from './useLibraryView.ts';

/** Counts and name of what the list shows, for the status bar. */
function scopeFacts(view: LibraryView) {
  const { scope } = view;
  if (scope?.kind === 'system') {
    const summary = view.systems.data?.find((system) => system.id === scope.systemId);
    return { games: summary?.games ?? 0, missing: summary?.missing ?? 0 };
  }
  if (scope?.kind === 'collection') {
    const collection = view.collections.data?.find((c) => c.id === scope.collectionId);
    return { games: collection?.games ?? 0, missing: 0, name: collection?.name ?? '' };
  }
  return { games: 0, missing: 0 };
}

/** Whether a flag change takes games out of the list shown on this tab. */
function leavesTab(tab: GameTab, flags: GameFlags): boolean {
  if (flags.hidden !== undefined) return (tab === 'hidden') !== flags.hidden;
  return tab === 'favorites' && flags.favorite === false;
}

/** The Game Library app (S7): system tree, virtualized game list, details panel, status bar. */
export function LibraryApp() {
  const { t } = useTranslation();
  useLibraryEvents();
  const view = useLibraryView();
  const list = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [relinking, setRelinking] = useState<number | null>(null);
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
          />
        </aside>
        <main ref={list} className="flex min-w-0 flex-1 flex-col">
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
