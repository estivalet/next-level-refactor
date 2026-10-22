import type { BootTarget, MenuNode, MenuTree, Settings } from '@nextlevel/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext } from 'react';
import { getBridge } from '../../bridge.ts';
import { FRONTEND_CLOSED, type FrontendState } from '../frontend/useFrontend.ts';
import { SETTINGS_KEY } from '../settings/settingsApi.ts';

const OPEN: FrontendState = { mounted: true, visible: true };

/** True when the menu reaches a system: the generated menu lists only systems with games. */
export function menuHasGames(menu: MenuTree): boolean {
  const walk = (nodes: readonly MenuNode[]): boolean =>
    nodes.some((node) => node.type === 'system' || walk(node.children));
  return walk(menu.items);
}

/** Owner decision D1: the boot target, but the desktop while the library has no games. */
export function bootFrontend(target: BootTarget, hasGames: boolean): FrontendState {
  if (!hasGames || target.kind === 'desktop') return FRONTEND_CLOSED;
  return OPEN;
}

/** Where the shell starts; set once by BootGate. */
export const BootRouteContext = createContext<FrontendState>(FRONTEND_CLOSED);

/**
 * Decides once, at boot, whether the launcher opens in the front-end (FR-THM-5). A chosen theme
 * is recorded as the last used before the shell shows, so the front-end opens it. Anything that
 * fails here boots to the desktop. (The first-run wizard joins this routing in M9.)
 */
export function useBootRoute(settings: Settings | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['boot.route'],
    enabled: settings !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<FrontendState> => {
      if (!settings) return FRONTEND_CLOSED;
      const target = settings.general.bootTarget;
      if (target.kind === 'desktop') return FRONTEND_CLOSED;
      try {
        const menu = await getBridge().invoke('frontend.menu');
        const route = bootFrontend(target, menu.ok && menuHasGames(menu.value));
        if (route.visible && target.kind === 'theme') {
          const opened = await getBridge().invoke('frontend.themeOpened', {
            themeId: target.themeId,
          });
          // The front-end reads the theme from the settings: wait for the saved copy.
          if (opened.ok) await client.refetchQueries({ queryKey: SETTINGS_KEY });
        }
        return route;
      } catch {
        return FRONTEND_CLOSED;
      }
    },
  });
}
