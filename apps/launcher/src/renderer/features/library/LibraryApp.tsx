import type { GameFlags, GameScope, MenuTree } from '@nextlevel/shared';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { GameDetails } from './GameDetails.tsx';
import { GameList } from './GameList.tsx';
import { GlobalSearch } from './GlobalSearch.tsx';
import { LibraryEmpty, LibraryUnavailable } from './LibraryEmpty.tsx';
import { LibraryOverlays, useOverlays } from './LibraryOverlays.tsx';
import { LibraryStatusBar } from './LibraryStatusBar.tsx';
import { useGlobalSearch, useLibraryEvents } from './libraryApi.ts';
import { ScrapeMenu } from '../scrape/ScrapeMenu.tsx';
import { ScanMenu } from './ScanMenu.tsx';
import { SearchResults } from './SearchResults.tsx';
import { NewCollectionButton } from './CollectionToolbar.tsx';
import { LibraryHome } from './home/LibraryHome.tsx';
import { COLLECTIONS_LEVEL, levelAt } from './home/levels.ts';
import { useActiveMenuTree } from './home/useActiveMenuTree.ts';
import { NewSmartFilterButton } from './SmartFilterToolbar.tsx';
import { useViewMode } from './useViewMode.ts';
import { useGameFacets } from './facetsApi.ts';
import { GameGrid } from './GameGrid.tsx';
import { ScopeSidebar } from './ScopeSidebar.tsx';
import { ViewToggle } from './ViewToggle.tsx';
import { ScopeToolbar } from './ScopeToolbar.tsx';
import { leavesTab, scopeFacts } from './scopeFacts.ts';
import { useCollectionDrag } from './useCollectionDrag.ts';
import { useLibraryView } from './useLibraryView.ts';
import { PlayLayer } from './PlayLayer.tsx';
import { usePlay } from './usePlay.ts';

const NO_MENU: MenuTree = { title: '', items: [] };

/**
 * The Game Library app (S7): search and scan header; the home browses the active menu (D61) and a
 * system, collection or smart filter opens its games with details and status.
 */
export function LibraryApp({
  initialScope = null,
}: {
  /** Where to open instead of the home (tests and deep links). */
  initialScope?: GameScope | null;
  /** Window parameters every app receives (unused). */
  params?: Readonly<Record<string, string>>;
}) {
  const { t } = useTranslation();
  useLibraryEvents();
  const view = useLibraryView(initialScope);
  const overlays = useOverlays();
  const menu = useActiveMenuTree();
  const [path, setPath] = useState<string[]>([]);
  const [homeView, setHomeView] = useViewMode('home');
  const [scopeView, setScopeView] = useViewMode(JSON.stringify(view.scope));
  const facets = useGameFacets(view.scope, view.tab);
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
  const shownCollectionId = view.scope?.kind === 'collection' ? view.scope.collectionId : null;
  const reorder = useCollectionDrag(
    view,
    view.collections.data?.find((c) => c.id === shownCollectionId),
  );
  const systemName = (id: string) => view.catalog.data?.find((s) => s.id === id)?.name ?? id;

  if (errorCode(view.systems.error) === 'LIBRARY_UNAVAILABLE') return <LibraryUnavailable />;
  if (view.systems.isPending || view.collections.isPending || menu.isPending) {
    return <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>;
  }
  if (!view.systems.data?.some((system) => system.games > 0)) return <LibraryEmpty />;

  const scope = view.scope;
  const facts = scopeFacts(view);
  // Without a readable menu the home still offers Not in menu and Collections.
  const tree = menu.data ?? { ...NO_MENU, title: t('library.home.title') };
  const level = levelAt(tree, path, {
    systems: view.systems.data,
    catalog: view.catalog.data ?? [],
    collections: view.collections.data ?? [],
    smartFilters: view.smartFilters.data ?? [],
    labels: { notInMenu: t('library.home.notInMenu'), collections: t('library.home.collections') },
  });
  // Rows drag into a manual-order collection's order only in the list.
  const manualOrder =
    scope?.kind === 'collection' &&
    view.collections.data?.find((c) => c.id === scope.collectionId)?.sort === 'manual';
  const shownView = manualOrder ? 'list' : scopeView;
  const scopeSystem =
    scope?.kind === 'system' ? { id: scope.systemId, name: systemName(scope.systemId) } : null;
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
        <div className="flex items-center gap-3">
          <ScrapeMenu
            system={scopeSystem}
            selectedIds={[...view.selection.ids]}
            onRules={(batchScope) => {
              overlays.openBatch(batchScope, systemName);
            }}
            onShowReview={(systemIds) => {
              const systemId = systemIds?.[0];
              if (systemId && !(scope?.kind === 'system' && scope.systemId === systemId)) {
                view.setScope({ kind: 'system', systemId });
              }
              view.setTab('needsReview');
            }}
          />
          <ScanMenu system={scopeSystem} />
        </div>
      </header>
      {!searching && !scope ? (
        <LibraryHome
          level={level}
          rootTitle={tree.title}
          view={homeView}
          onView={setHomeView}
          onPath={setPath}
          onOpen={(card) => {
            if (card.scope) view.setScope(card.scope);
            else setPath([...level.path, card.key]);
          }}
          actions={
            level.path[0] === COLLECTIONS_LEVEL ? (
              <div className="flex items-center gap-1">
                <NewCollectionButton
                  onClick={() => {
                    overlays.openCollection({ kind: 'new' });
                  }}
                />
                <NewSmartFilterButton
                  onClick={() => {
                    overlays.openSmartFilter({ kind: 'new' });
                  }}
                />
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {scope && !searching && (
            <ScopeSidebar
              tab={view.tab}
              onTab={view.setTab}
              facets={facets.data}
              narrow={view.narrow}
              onNarrow={view.setNarrow}
            />
          )}
          <main ref={list} className="flex min-w-0 flex-1 flex-col">
            {searching || !scope ? (
              <SearchResults
                result={search.data}
                selectedId={searchPick}
                onSelect={setSearchPick}
                onActivate={(game) => {
                  if (!game.missing) play.play(game.id);
                }}
                systemName={systemName}
              />
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white"
                    onClick={view.resetScope}
                  >
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    {t('library.home.back')}
                  </button>
                  <h2 className="flex-1 truncate text-sm font-semibold text-white">
                    {facts.name ?? systemName(scope.kind === 'system' ? scope.systemId : '')}
                  </h2>
                  <ViewToggle view={shownView} onView={setScopeView} gridDisabled={manualOrder} />
                </div>
                <ScopeToolbar view={view} overlays={overlays} />
                {shownView === 'grid' ? (
                  <GameGrid
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
                ) : (
                  <GameList
                    reorder={reorder}
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
                )}
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
      )}
      {scope && (
        <LibraryStatusBar
          games={facts.games}
          missing={facts.missing}
          {...('review' in facts ? { review: facts.review } : {})}
          {...(scope.kind === 'system' ? { sort: view.sort, onSort: view.setSort } : {})}
          scopeName={facts.name ?? systemName(scope.kind === 'system' ? scope.systemId : '')}
        />
      )}
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
