import {
  artUrl,
  mediaUrl,
  type AppError,
  type NextLevelBridge,
  type Result,
  type Settings,
} from '@nextlevel/shared';
import type { HostEvent, ThemeHost } from '@nextlevel/themes';

export interface LauncherHostDeps {
  /** The settings as the renderer last loaded them. */
  settings: () => Settings;
  /** Translates an error's message key. */
  t: (key: string) => string;
  /** Shows a failed launch to the user (US-C2: the reason and Fix in Settings). */
  onLaunchError?: (gameId: number, error: AppError) => void;
}

/**
 * The launcher's ThemeHost (FR-THM-6, ADR-010): every call goes over the typed bridge, and main's
 * events become host events. Settings announced by main are used at once, before the renderer's
 * own copy catches up, so a theme re-reading options or input sees the new values.
 */
export function createLauncherThemeHost(
  bridge: NextLevelBridge,
  deps: LauncherHostDeps,
): ThemeHost {
  let announced: Settings | null = null;
  const settings = () => announced ?? deps.settings();

  const value = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(deps.t(result.error.message));
    return result.value;
  };

  return {
    getMenu: async () => value(await bridge.invoke('frontend.menu')),
    getGames: async (nodeId) => value(await bridge.invoke('frontend.games', { nodeId })),
    getGameDetails: async (gameId) => {
      const details = value(await bridge.invoke('library.games.get', { gameId }));
      return { description: details.description };
    },
    loadArtIndex: async (themeId, opts) =>
      value(
        await bridge.invoke(
          'frontend.artIndex',
          opts?.refresh ? { themeId, refresh: true } : { themeId },
        ),
      ),
    mediaUrl: (game, kind) => (game.media.includes(kind) ? mediaUrl(game.id, kind) : null),
    artUrl,
    launch: async (gameId) => {
      const result = await bridge.invoke('launch.game', { gameId });
      if (result.ok) return { ok: true };
      const message = deps.t(result.error.message);
      if (!deps.onLaunchError) return { ok: false, message };
      deps.onLaunchError(gameId, result.error);
      return { ok: false, message, reported: true };
    },
    setGameFlags: async (gameId, flags) => {
      const result = await bridge.invoke('library.games.setFlags', { gameIds: [gameId], flags });
      return result.ok;
    },
    themeOptions: (themeId) => settings().themes.entries[themeId],
    input: () => settings().input,
    onEvent: (listener: (event: HostEvent) => void) => {
      const offs = [
        bridge.on('library.changed', ({ systems, gameIds }) => {
          listener(
            gameIds
              ? { type: 'library-changed', systems, gameIds }
              : { type: 'library-changed', systems },
          );
        }),
        bridge.on('launch.finished', ({ gameId, error }) => {
          listener({ type: 'launch-finished', gameId, ok: !error });
        }),
        bridge.on('settings.changed', (snapshot) => {
          announced = snapshot.settings;
          listener({ type: 'settings-changed' });
        }),
      ];
      return () => {
        offs.forEach((off) => {
          off();
        });
      };
    },
  };
}
