import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBridge } from '../../../bridge.ts';
import { useIpcEvent } from '../../../events.ts';
import { MENUS_KEY } from '../../menus/menusApi.ts';
import { unwrap } from '../../settings/settingsApi.ts';

const TREE_KEY = [...MENUS_KEY, 'tree'] as const;

/**
 * The active menu as themes see it (or the generated one), for the Library home (D61). Refreshed
 * when a menu changes and after a scan, which can show or hide systems.
 */
export function useActiveMenuTree() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: TREE_KEY });
  };
  useIpcEvent('menus.changed', refresh);
  useIpcEvent('scan.finished', refresh);
  return useQuery({
    queryKey: TREE_KEY,
    queryFn: async () => unwrap(await getBridge().invoke('frontend.menu')),
  });
}
