import type { FrontendService } from './frontend/FrontendService.ts';
import type { IpcHandlers } from './ipc/router.ts';

type FrontendChannel = Extract<keyof IpcHandlers, `frontend.${string}`>;

/** Front-end (themes) channels (FR-THM-6): the menu tree and whole game levels. */
export function createFrontendHandlers(deps: {
  frontend: () => Pick<FrontendService, 'menu' | 'games'>;
}): Pick<IpcHandlers, FrontendChannel> {
  return {
    'frontend.menu': () => deps.frontend().menu(),
    'frontend.games': ({ nodeId }) => deps.frontend().games(nodeId),
  };
}
