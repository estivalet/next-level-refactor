import type { UpdateState } from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';
import type { UpdateService } from './UpdateService.ts';

type UpdateChannel = Extract<keyof IpcHandlers, `update.${string}`>;

/** Where every release is listed (electron-builder.yml `publish`). */
export const RELEASES_PAGE = 'https://github.com/estivalet/next-level-refactor/releases';

const NOT_WIRED: UpdateState = {
  kind: 'unsupported',
  reason: 'dev',
  availableVersion: null,
  releaseUrl: null,
};

/**
 * Update channels (NFR-UPD-1, D53); without a service the launcher acts as a development build.
 * `update.openRelease` opens only a URL main found itself, never one from the renderer.
 */
export function createUpdateHandlers(
  service: Pick<UpdateService, 'state' | 'check' | 'restart'> | undefined,
  openExternal: (url: string) => Promise<void>,
): Pick<IpcHandlers, UpdateChannel> {
  const state = () => service?.state() ?? NOT_WIRED;
  return {
    'update.state': state,
    'update.check': () => service?.check() ?? NOT_WIRED,
    'update.restart': () => {
      service?.restart();
    },
    'update.openRelease': () => {
      const current = state();
      const url = current.kind === 'unsupported' ? current.releaseUrl : null;
      return openExternal(url ?? RELEASES_PAGE);
    },
  };
}
