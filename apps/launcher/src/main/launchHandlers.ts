import type { EmulatorPreset } from '@nextlevel/shared';
import type { EmitEvent } from './ipc/events.ts';
import type { IpcHandlers } from './ipc/router.ts';
import { detectEmulators } from './launch/detect.ts';
import type { LaunchService } from './launch/LaunchService.ts';
import type { LaunchRepository } from './library/LaunchRepository.ts';

export type LaunchChannel = Extract<
  keyof IpcHandlers,
  | `launch.${string}`
  | `emulators.${string}`
  | 'library.games.launchOverride'
  | 'library.games.setLaunchOverride'
  | 'app.pickFile'
>;

export interface LaunchHandlerDeps {
  /** The launch service and repository; throws when the library could not be opened. */
  launch: () => { service: LaunchService; launches: LaunchRepository };
  emit: EmitEvent;
  presets: () => readonly EmulatorPreset[];
  /** Native file dialog for an emulator executable; null when cancelled. */
  pickFile: (title?: string) => Promise<string | null>;
}

/** Launching, the launch log, per-game launch options and emulator presets (FR-EMU-2..10). */
export function createLaunchHandlers(deps: LaunchHandlerDeps): Pick<IpcHandlers, LaunchChannel> {
  return {
    'launch.game': ({ gameId }) => deps.launch().service.play(gameId),
    'launch.test': (draft) => deps.launch().service.test(draft),
    'launch.preview': (draft) => deps.launch().service.preview(draft),
    'launch.log': ({ offset, limit }) => deps.launch().launches.page(offset, limit),
    'launch.running': () => deps.launch().service.running(),
    'library.games.launchOverride': ({ gameId }) => {
      const { launches } = deps.launch();
      launches.gameInfo(gameId);
      return launches.getOverride(gameId);
    },
    'library.games.setLaunchOverride': ({ gameId, override }) => {
      const { launches } = deps.launch();
      const { systemId } = launches.gameInfo(gameId);
      launches.setOverride(gameId, override);
      deps.emit('library.changed', { systems: [systemId], gameIds: [gameId] });
      return launches.getOverride(gameId);
    },
    'emulators.presets': () => [...deps.presets()],
    'emulators.detect': ({ folder }) => detectEmulators(folder, deps.presets()),
    'app.pickFile': ({ title }) => deps.pickFile(title),
  };
}
