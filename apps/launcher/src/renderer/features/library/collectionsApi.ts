import type { CollectionSort } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { unwrap } from '../settings/settingsApi.ts';
import { COLLECTIONS_KEY, invalidateGames } from './libraryApi.ts';

/** Collections with their game counts (FR-LIB-8). */
export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('collections.list')),
  });
}

/** A collection change refreshes the collection list and every game view that shows membership. */
function useCollectionMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    // invalidateGames covers the collection list too.
    onSuccess: () => invalidateGames(client),
  });
}

export function useCreateCollection() {
  return useCollectionMutation(async (name: string) =>
    unwrap(await getBridge().invoke('collections.create', { name })),
  );
}

export function useUpdateCollection() {
  return useCollectionMutation(
    async (input: { id: number; name?: string; sort?: CollectionSort }) =>
      unwrap(await getBridge().invoke('collections.update', input)),
  );
}

export function useDeleteCollection() {
  return useCollectionMutation(async (id: number) => {
    unwrap(await getBridge().invoke('collections.delete', { id }));
  });
}

export function useAddToCollection() {
  return useCollectionMutation(async (input: { id: number; gameIds: number[] }) =>
    unwrap(await getBridge().invoke('collections.addGames', input)),
  );
}

export function useRemoveFromCollection() {
  return useCollectionMutation(async (input: { id: number; gameIds: number[] }) =>
    unwrap(await getBridge().invoke('collections.removeGames', input)),
  );
}

export function useReorderCollection() {
  return useCollectionMutation(
    async (input: { id: number; gameId: number; swapWithGameId: number }) => {
      unwrap(await getBridge().invoke('collections.reorder', input));
    },
  );
}

/** Drag reorder (D11): the games, in order, go right before `beforeGameId` (null = the end). */
export function useMoveInCollection() {
  return useCollectionMutation(
    async (input: { id: number; gameIds: number[]; beforeGameId: number | null }) => {
      unwrap(await getBridge().invoke('collections.move', input));
    },
  );
}
