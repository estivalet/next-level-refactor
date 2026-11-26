import type { GameFacets } from '@nextlevel/shared';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CollectionToolbar } from './CollectionToolbar.tsx';
import { DeleteLaterBar } from './DeleteLaterBar.tsx';
import { scopeTitle } from './scopeFacts.ts';
import type { Overlays } from './LibraryOverlays.tsx';
import { SmartFilterToolbar } from './SmartFilterToolbar.tsx';
import type { LibraryView } from './useLibraryView.ts';

/**
 * The toolbars above the list: the collection's or smart filter's, then, on a Missing tab with
 * games, Remove all missing… (FR-LIB-14, US-C7), and on a Delete later tab with games, Export
 * cleanup script… (FR-LIB-20, US-C14).
 */
export function ScopeToolbar(props: {
  view: LibraryView;
  overlays: Overlays;
  /** The scope's facets (tab counts); undefined while loading. */
  facets: GameFacets | undefined;
}) {
  const { view, overlays, facets } = props;
  const missing = facets?.tabs.missing;
  const deleteLater = facets?.tabs.deleteLater;
  const { t } = useTranslation();
  const scope = view.scope;
  return (
    <>
      <OwnToolbar view={view} overlays={overlays} />
      {scope && view.tab === 'missing' && missing !== undefined && missing > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2">
          <span className="flex-1 text-[11px] text-slate-500">
            {t('library.remove.missingCount', { count: missing })}
          </span>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => {
              overlays.remove({ allMissingIn: scope, count: missing });
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            {t('library.remove.all')}
          </button>
        </div>
      )}
      {scope && view.tab === 'deleteLater' && deleteLater !== undefined && deleteLater > 0 && (
        <DeleteLaterBar scope={scope} title={scopeTitle(view)} count={deleteLater} />
      )}
    </>
  );
}

/** The collection's or smart filter's toolbar; nothing for a system. */
function OwnToolbar({ view, overlays }: { view: LibraryView; overlays: Overlays }) {
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
