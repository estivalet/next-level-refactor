import {
  AppErrorException,
  ERROR_CODES,
  type DownloadSummary,
  type InstallState,
} from '@nextlevel/shared';
import type { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import type { CatalogClient } from './CatalogClient.ts';
import type { CatalogApi } from './catalogHandlers.ts';
import type { DownloadService } from './DownloadService.ts';
import type { Installer } from './Installer.ts';
import type { ItemLocks } from './itemLocks.ts';

export interface CatalogApiDeps {
  client: Pick<CatalogClient, 'list' | 'get'>;
  downloads: Pick<DownloadService, 'list' | 'install' | 'pause' | 'resume' | 'cancel'>;
  installer: Pick<Installer, 'uninstall'>;
  installs: Pick<CatalogInstallRepository, 'all' | 'byItem'>;
  locks: ItemLocks;
}

/**
 * The catalog channels (FR-CAT-1..7): the API's items with where each stands on this PC, the
 * download queue, and uninstall under the item's lock (it waits for a running sync, D43).
 */
export function createCatalogApi(deps: CatalogApiDeps): CatalogApi {
  const stateOf = (
    queue: readonly DownloadSummary[],
    itemId: string,
    version: number,
  ): InstallState => {
    const download = queue.find((row) => row.itemId === itemId);
    if (download?.state === 'failed') return 'failed';
    if (download?.state === 'queued') return 'queued';
    if (download) return 'downloading';
    const install = deps.installs.byItem(itemId);
    if (!install) return 'none';
    if (install.state === 'gone') return 'gone';
    return install.state === 'update' || install.version < version ? 'update' : 'installed';
  };

  return {
    async list(query) {
      const page = await deps.client.list(query);
      const queue = deps.downloads.list();
      return {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          installState: stateOf(queue, item.id, item.version),
        })),
      };
    },
    async get(itemId) {
      const item = await deps.client.get(itemId);
      return { ...item, installState: stateOf(deps.downloads.list(), item.id, item.version) };
    },
    install: (itemId) => deps.downloads.install(itemId),
    uninstall: (itemId, confirm) => {
      if (!deps.installs.byItem(itemId)) {
        return Promise.reject(
          new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
        );
      }
      return deps.locks.run(itemId, () => deps.installer.uninstall(itemId, confirm));
    },
    installed: () =>
      deps.installs.all().map((install) => ({
        itemId: install.itemId,
        gameId: install.gameId,
        title: install.title,
        systemId: install.systemId,
        version: install.version,
        state: install.state,
        onLapse: install.onLapse,
        installedAt: install.installedAt,
      })),
    downloads: () => deps.downloads.list(),
    pause: (id) => deps.downloads.pause(id),
    resume: (id) => deps.downloads.resume(id),
    cancel: (id) => deps.downloads.cancel(id),
  };
}
