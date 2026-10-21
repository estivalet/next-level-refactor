import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { errorCode } from '../settings/settingsApi.ts';
import { GameList } from './GameList.tsx';
import { LibraryEmpty, LibraryUnavailable } from './LibraryEmpty.tsx';
import { LibraryStatusBar } from './LibraryStatusBar.tsx';
import { useLibraryEvents } from './libraryApi.ts';
import { SystemTree } from './SystemTree.tsx';
import { useLibraryView, type LibraryView } from './useLibraryView.ts';

/** Counts and name of what the list shows, for the status bar. */
function scopeFacts(view: LibraryView) {
  const { scope } = view;
  if (scope?.kind === 'system') {
    const summary = view.systems.data?.find((system) => system.id === scope.systemId);
    const name = view.catalog.data?.find((system) => system.id === scope.systemId)?.name;
    return {
      games: summary?.games ?? 0,
      missing: summary?.missing ?? 0,
      name: name ?? scope.systemId,
    };
  }
  if (scope?.kind === 'collection') {
    const collection = view.collections.data?.find((c) => c.id === scope.collectionId);
    return { games: collection?.games ?? 0, missing: 0, name: collection?.name ?? '' };
  }
  return { games: 0, missing: 0, name: '' };
}

/** The Game Library app (S7): system tree, virtualized game list, details panel, status bar. */
export function LibraryApp() {
  const { t } = useTranslation();
  useLibraryEvents();
  const view = useLibraryView();
  const { setRange } = view;
  const onRange = useCallback(
    (first: number, last: number) => {
      setRange(first, last);
    },
    [setRange],
  );

  if (errorCode(view.systems.error) === 'LIBRARY_UNAVAILABLE') return <LibraryUnavailable />;
  if (view.systems.isPending || view.collections.isPending) {
    return <p className="p-6 text-sm text-slate-500">{t('library.list.loading')}</p>;
  }
  if (!view.scope) return <LibraryEmpty />;

  const facts = scopeFacts(view);
  return (
    <div className="flex h-full flex-col bg-[#0b0b0f] text-slate-300">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#111115]">
          <SystemTree
            rows={view.tree}
            scope={view.scope}
            onSelectScope={view.setScope}
            onToggleGroup={view.toggleGroup}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <GameList
            games={view.games}
            selection={view.selection}
            focused={view.focused}
            onSelect={view.selectRow}
            onRange={onRange}
          />
        </main>
        <aside
          aria-label={t('library.details.label')}
          className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-white/5 bg-[#111115]"
        >
          <p className="p-4 text-xs text-slate-500">{t('library.details.none')}</p>
        </aside>
      </div>
      <LibraryStatusBar
        games={facts.games}
        missing={facts.missing}
        tab={view.tab}
        onTab={view.setTab}
        {...(view.scope.kind === 'system' ? { sort: view.sort, onSort: view.setSort } : {})}
        scopeName={facts.name}
      />
    </div>
  );
}
