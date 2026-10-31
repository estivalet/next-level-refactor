import type { GameFlags, GameTab } from '@nextlevel/shared';
import type { LibraryView } from './useLibraryView.ts';

/** Counts and name of what the list shows, for the status bar. */
export function scopeFacts(view: LibraryView) {
  const { scope } = view;
  if (scope?.kind === 'system') {
    const summary = view.systems.data?.find((system) => system.id === scope.systemId);
    return {
      games: summary?.games ?? 0,
      missing: summary?.missing ?? 0,
      review: summary?.review ?? 0,
    };
  }
  if (scope?.kind === 'collection') {
    const collection = view.collections.data?.find((c) => c.id === scope.collectionId);
    return { games: collection?.games ?? 0, missing: 0, name: collection?.name ?? '' };
  }
  if (scope?.kind === 'smartFilter') {
    const filter = view.smartFilters.data?.find((f) => f.id === scope.smartFilterId);
    return { games: filter?.games ?? 0, missing: 0, name: filter?.name ?? '' };
  }
  return { games: 0, missing: 0 };
}

/** Whether a flag change takes games out of the list shown on this tab. */
export function leavesTab(tab: GameTab, flags: GameFlags): boolean {
  if (flags.hidden !== undefined) return (tab === 'hidden') !== flags.hidden;
  if (tab === 'completed') return flags.completed === false;
  return tab === 'favorites' && flags.favorite === false;
}
