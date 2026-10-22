import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { useCollections } from '../library/collectionsApi.ts';
import {
  COLLECTIONS_KEY,
  SYSTEMS_KEY,
  useLibraryEvents,
  useSystemSummaries,
} from '../library/libraryApi.ts';
import { unwrap, useSystemCatalog } from '../settings/settingsApi.ts';
import type { MenuRefs } from './nodeStatus.ts';

export const SMART_FILTERS_KEY = ['smartFilters.list'] as const;

export function useSmartFilterList() {
  return useQuery({
    queryKey: SMART_FILTERS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('smartFilters.list')),
  });
}

/**
 * What menu nodes can point at (FR-MENU-2), kept fresh: game changes, scans, settings (systems
 * enabled) and menu-related changes refetch it. Null until everything has loaded.
 */
export function useMenuRefs(): MenuRefs | null {
  const client = useQueryClient();
  useLibraryEvents();
  const refresh = (keys: ReadonlyArray<readonly string[]>) => {
    for (const queryKey of keys) void client.invalidateQueries({ queryKey });
  };
  useIpcEvent('menus.changed', () => {
    refresh([SYSTEMS_KEY, COLLECTIONS_KEY, SMART_FILTERS_KEY]);
  });
  useIpcEvent('library.changed', () => {
    refresh([SMART_FILTERS_KEY]);
  });
  useIpcEvent('settings.changed', () => {
    refresh([SYSTEMS_KEY]);
  });
  const catalog = useSystemCatalog().data;
  const systems = useSystemSummaries().data;
  const collections = useCollections().data;
  const smartFilters = useSmartFilterList().data;
  return useMemo(() => {
    if (!catalog || !systems || !collections || !smartFilters) return null;
    const own = new Map(systems.map((s) => [s.id, s]));
    return {
      systems: new Map(
        catalog.map((system) => {
          const summary = own.get(system.id);
          return [
            system.id,
            {
              name: system.name,
              manufacturer: system.manufacturer,
              enabled: summary?.enabled ?? false,
              games: (summary?.games ?? 0) - (summary?.missing ?? 0),
            },
          ];
        }),
      ),
      collections: new Map(collections.map((c) => [c.id, { name: c.name, games: c.games }])),
      smartFilters: new Map(smartFilters.map((f) => [f.id, { name: f.name, games: f.games }])),
    };
  }, [catalog, systems, collections, smartFilters]);
}
