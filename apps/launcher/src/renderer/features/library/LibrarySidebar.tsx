import type { GameScope } from '@nextlevel/shared';
import { NewCollectionButton } from './CollectionToolbar.tsx';
import type { Overlays } from './LibraryOverlays.tsx';
import { NewSmartFilterButton } from './SmartFilterToolbar.tsx';
import { SystemTree } from './SystemTree.tsx';
import type { LibraryView } from './useLibraryView.ts';

/** The Library's left column: systems, collections and smart filters, each list with its "+". */
export function LibrarySidebar({
  view,
  scope,
  overlays,
  onSelectScope,
}: {
  view: LibraryView;
  scope: GameScope;
  overlays: Overlays;
  onSelectScope: (scope: GameScope) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-[#111115]">
      <SystemTree
        rows={view.tree}
        scope={scope}
        onSelectScope={onSelectScope}
        onToggleGroup={view.toggleGroup}
        collectionsAction={
          <NewCollectionButton
            onClick={() => {
              overlays.openCollection({ kind: 'new' });
            }}
          />
        }
        smartFiltersAction={
          <NewSmartFilterButton
            onClick={() => {
              overlays.openSmartFilter({ kind: 'new' });
            }}
          />
        }
      />
    </aside>
  );
}
