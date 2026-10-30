import {
  AppErrorException,
  catalogArtUrl,
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
  downloads: Pick<
    DownloadService,
    'list' | 'install' | 'pause' | 'resume' | 'cancel' | 'cancelItem'
  >;
  installer: Pick<Installer, 'uninstall'>;
  installs: Pick<CatalogInstallRepository, 'all' | 'byItem'>;
  locks: ItemLocks;
  /** One art file by its signed URL (fetchArt). */
  fetchArt: (url: string) => Promise<{ bytes: Buffer; format: string } | null>;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

/**
 * The catalog channels (FR-CAT-1..7): the API's items with where each stands on this PC, the
 * download queue, and uninstall under the item's lock (it waits for a running sync, D43).
 */
export function createCatalogApi(deps: CatalogApiDeps): CatalogApi & {
  /** For `nextlevel://catalog-art/<item>/<kind>`: the art main last saw for it (S8). */
  art(itemId: string, kind: string): Promise<{ bytes: Buffer; mime: string } | null>;
} {
  // Signed art URLs stay in main (they carry tokens); the renderer gets nextlevel:// names.
  const signed = new Map<string, string>();
  const local = (itemId: string, kind: string, url: string) => {
    signed.set(`${itemId}/${kind}`, url);
    return catalogArtUrl(itemId, kind);
  };
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
          boxArt: item.boxArt ? local(item.id, 'box-front', item.boxArt) : null,
          installState: stateOf(queue, item.id, item.version),
        })),
      };
    },
    async get(itemId) {
      const item = await deps.client.get(itemId);
      return {
        ...item,
        boxArt: item.boxArt ? local(item.id, 'box-front', item.boxArt) : null,
        media: item.media.map((media) => ({
          kind: media.kind,
          url: local(item.id, media.kind, media.url),
        })),
        installState: stateOf(deps.downloads.list(), item.id, item.version),
      };
    },
    async art(itemId, kind) {
      const key = `${itemId}/${kind}`;
      const url = signed.get(key);
      if (!url) return null;
      let fetched = await deps.fetchArt(url);
      if (!fetched) {
        // Signed art URLs live an hour: ask the API for the item again, then try once more.
        const fresh = await deps.client.get(itemId).catch(() => null);
        const again =
          kind === 'box-front' && fresh?.boxArt
            ? fresh.boxArt
            : fresh?.media.find((media) => media.kind === kind)?.url;
        if (again) {
          signed.set(key, again);
          fetched = await deps.fetchArt(again);
        }
      }
      const mime = fetched ? MIME[fetched.format] : undefined;
      return fetched && mime ? { bytes: fetched.bytes, mime } : null;
    },
    install: (itemId) => deps.downloads.install(itemId),
    uninstall: (itemId, confirm) => {
      if (!deps.installs.byItem(itemId)) {
        return Promise.reject(
          new AppErrorException({ code: 'NOT_FOUND', message: ERROR_CODES.NOT_FOUND }),
        );
      }
      // Its download (an Update) is cancelled first, outside the lock its install step takes.
      return deps.downloads
        .cancelItem(itemId)
        .then(() => deps.locks.run(itemId, () => deps.installer.uninstall(itemId, confirm)));
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
