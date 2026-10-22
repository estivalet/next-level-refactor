import type { GameFlags } from '@nextlevel/shared';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { CollectionToolbar, NewCollectionButton } from './CollectionToolbar.tsx';
import { GameDetails } from './GameDetails.tsx';
import { GameList } from './GameList.tsx';
import { GlobalSearch } from './GlobalSearch.tsx';
import { LibraryEmpty, LibraryUnavailable } from './LibraryEmpty.tsx';
import { LibraryOverlays, useOverlays } from './LibraryOverlays.tsx';
import { LibraryStatusBar } from './LibraryStatusBar.tsx';
import { useGlobalSearch, useLibraryEvents } from './libraryApi.ts';
import { ScanMenu } from './ScanMenu.tsx';
import { SearchResults } from './SearchResults.tsx';
import { SystemTree } from './SystemTree.tsx';
import { leavesTab, scopeFacts } from './scopeFacts.ts';
import { useLibraryView } from './useLibraryView.ts';
import { PlayLayer } from './PlayLayer.tsx';
import { usePlay } from './usePlay.ts';

/** The Game Library app (S7): search and scan header, system tree, game list, details, status. */
export function LibraryApp() {
  const { t } = useTranslation();
  useLibraryEvents();
  const view = useLibraryView();
  const overlays = useOverlays();
  const list = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState('');
  const [searchPick, setSearchPick] = useState<number | null>(null);
  const search = useGlobalSearch(searchText);
  const focusList = () => {
    list.current?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  };
  // Back from a game, the same row is still selected: give it the keyboard again.
  const play = usePlay({ onFinished: focusList });
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

  const scope = view.scope;
  const facts = scopeFacts(view);
  const collection =
    scope.kind === 'collection'
      ? view.collections.data?.find((c) => c.id === scope.collectionId)
      : undefined;
  const searching = search.active;
  const onFlags = (flags: GameFlags) => {
    if (searching || !leavesTab(view.tab, flags)) return;
    // The next row moves up into place: keep the focus on the top of the selection.
    view.focusRow(Math.min(view.focused, view.selection.anchor ?? view.focused));
  };

  return (
    <div className="relative flex h-full flex-col bg-[#0b0b0f] text-slate-300">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-[#111115] px-4 py-2">
        <GlobalSearch
          text={searchText}
          onText={(text) => {
            setSearchText(text);
            setSearchPick(null);
          }}
          onArrowDown={() => {
            focusList();
            const first = search.data?.games[0];
            if (searchPick === null && first) setSearchPick(first.id);
          }}
        />
        <ScanMenu
          system={
            scope.kind === 'system'
              ? { id: scope.systemId, name: systemName(scope.systemId) }
              : null
          }
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#111115]">
          <SystemTree
            rows={view.tree}
            scope={scope}
            onSelectScope={(next) => {
              setSearchText('');
              view.setScope(next);
            }}
            onToggleGroup={view.toggleGroup}
            collectionsAction={
              <NewCollectionButton
                onClick={() => {
                  overlays.openCollection({ kind: 'new' });
                }}
              />
            }
          />
        </aside>
        <main ref={list} className="flex min-w-0 flex-1 flex-col">
          {searching ? (
            <SearchResults
              result={search.data}
              selectedId={searchPick}
              onSelect={setSearchPick}
              systemName={systemName}
            />
          ) : (
            <>
              {collection && (
                <CollectionToolbar
                  collection={collection}
                  focused={
                    view.focusedGame ? { index: view.focused, gameId: view.focusedGame.id } : null
                  }
                  gameIdAt={(index) => view.games.rowAt(index)?.id}
                  onMoved={view.focusRow}
                  onRename={() => {
                    overlays.openCollection({ kind: 'rename', collection });
                  }}
                  onDelete={() => {
                    overlays.openCollection({ kind: 'delete', collection });
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
                  overlays.openMenu(point);
                }}
                onActivate={(index) => {
                  const game = view.games.rowAt(index);
                  if (game && !game.missing) play.play(game.id);
                }}
              />
            </>
          )}
        </main>
        <aside
          aria-label={t('library.details.label')}
          className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-white/5 bg-[#111115]"
        >
          <GameDetails
            gameId={searching ? searchPick : (view.focusedGame?.id ?? null)}
            systemName={systemName}
            onEdit={overlays.edit}
            onRelink={overlays.relink}
            onFlags={onFlags}
            onPlay={play.play}
            playBusy={play.busy}
            onLaunchOptions={overlays.openLaunchOptions}
          />
        </aside>
      </div>
      <LibraryStatusBar
        games={facts.games}
        missing={facts.missing}
        tab={view.tab}
        onTab={view.setTab}
        {...(scope.kind === 'system' ? { sort: view.sort, onSort: view.setSort } : {})}
        scopeName={facts.name ?? systemName(scope.kind === 'system' ? scope.systemId : '')}
      />
      <LibraryOverlays
        view={view}
        overlays={overlays}
        onFlags={onFlags}
        {...(play.busy ? {} : { onPlay: play.play })}
        onMenuClosed={focusList}
      />
      <PlayLayer play={play} />
    </div>
  );
}
