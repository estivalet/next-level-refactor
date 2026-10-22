import type { ArtIndexService } from './frontend/ArtIndexService.ts';
import type { FrontendService } from './frontend/FrontendService.ts';
import type { IpcHandlers } from './ipc/router.ts';

type FrontendChannel = Extract<keyof IpcHandlers, `frontend.${string}`>;

/**
 * Front-end (themes) channels (FR-THM-2, FR-THM-5, FR-THM-6): menu tree, whole game levels, art
 * index, and the theme the front-end opened.
 */
export function createFrontendHandlers(deps: {
  frontend: () => Pick<FrontendService, 'menu' | 'games'>;
  artIndex: Pick<ArtIndexService, 'index'>;
  rememberTheme: (themeId: string) => Promise<void>;
}): Pick<IpcHandlers, FrontendChannel> {
  return {
    'frontend.artIndex': ({ themeId, refresh }) =>
      deps.artIndex.index(themeId, refresh ? { refresh } : {}),
    'frontend.menu': () => deps.frontend().menu(),
    'frontend.games': ({ nodeId }) => deps.frontend().games(nodeId),
    'frontend.themeOpened': ({ themeId }) => deps.rememberTheme(themeId),
  };
}
