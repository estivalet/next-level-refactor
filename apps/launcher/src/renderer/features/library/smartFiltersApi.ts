import type { SmartFilterQuery } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { invalidateGames, SMART_FILTERS_KEY } from './libraryApi.ts';

export { SMART_FILTERS_KEY };

/** Smart filters with their present-game and menu counts (FR-LIB-9). */
export function useSmartFilters() {
  return useQuery({
    queryKey: SMART_FILTERS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('smartFilters.list')),
  });
}

/** A smart filter change refreshes the list and every game view (one may show that filter). */
function useSmartFilterMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: SMART_FILTERS_KEY }),
        invalidateGames(client),
      ]),
  });
}

export function useCreateSmartFilter() {
  return useSmartFilterMutation(async (input: { name: string; query: SmartFilterQuery }) =>
    unwrap(await getBridge().invoke('smartFilters.create', input)),
  );
}

export function useUpdateSmartFilter() {
  return useSmartFilterMutation(
    async (input: { id: number; name: string; query: SmartFilterQuery }) =>
      unwrap(await getBridge().invoke('smartFilters.update', input)),
  );
}

export function useDeleteSmartFilter() {
  return useSmartFilterMutation(async (id: number) => {
    unwrap(await getBridge().invoke('smartFilters.delete', { id }));
  });
}
