import type { MenuDocNode } from '@nextlevel/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getBridge } from '../../bridge.ts';
import { useIpcEvent } from '../../events.ts';
import { unwrap } from '../settings/settingsApi.ts';

export const MENUS_KEY = ['menus'] as const;

/** Every stored menu (FR-MENU-1), refreshed on `menus.changed`. */
export function useMenuList() {
  const client = useQueryClient();
  useIpcEvent('menus.changed', () => {
    void client.invalidateQueries({ queryKey: MENUS_KEY });
  });
  return useQuery({
    queryKey: [...MENUS_KEY, 'list'],
    queryFn: async () => unwrap(await getBridge().invoke('menus.list')),
  });
}

const invalidate = (client: QueryClient) => client.invalidateQueries({ queryKey: MENUS_KEY });

function useMenuMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate(client) });
}

export function useCreateMenu() {
  return useMenuMutation(async (input: { title: string; nodes: MenuDocNode[] }) =>
    unwrap(await getBridge().invoke('menus.create', input)),
  );
}

export function useDeleteMenu() {
  return useMenuMutation(async (id: string) => {
    unwrap(await getBridge().invoke('menus.delete', { id }));
  });
}

export function useSetActiveMenu() {
  return useMenuMutation(async (id: string) => {
    unwrap(await getBridge().invoke('menus.setActive', { id }));
  });
}

/** A menu generated from the enabled systems with games, as of now (FR-MENU-3). */
export async function fetchGeneratedMenu() {
  return unwrap(await getBridge().invoke('menus.generated'));
}
