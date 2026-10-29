import {
  AppErrorException,
  ERROR_CODES,
  type CatalogDetail,
  type CatalogListPage,
  type CatalogQuery,
  type DownloadSummary,
  type InstalledItem,
} from '@nextlevel/shared';
import type { IpcHandlers } from '../ipc/router.ts';

type CatalogChannel =
  | 'catalog.list'
  | 'catalog.get'
  | 'catalog.install'
  | 'catalog.uninstall'
  | 'catalog.installed'
  | 'downloads.list'
  | 'downloads.pause'
  | 'downloads.resume'
  | 'downloads.cancel';

/** What the catalog channels need from main (startCatalog). */
export interface CatalogApi {
  list(query: CatalogQuery): Promise<CatalogListPage>;
  get(itemId: string): Promise<CatalogDetail>;
  install(itemId: string): Promise<DownloadSummary>;
  uninstall(itemId: string, confirm: boolean): Promise<void>;
  installed(): InstalledItem[];
  downloads(): DownloadSummary[];
  pause(downloadId: string): Promise<void>;
  resume(downloadId: string): Promise<void>;
  cancel(downloadId: string): Promise<void>;
}

const unreachable = () =>
  Promise.reject(
    new AppErrorException({ code: 'API_UNREACHABLE', message: ERROR_CODES.API_UNREACHABLE }),
  );

/** No catalog (sign-in off, or before the library is open): nothing installed, no API. */
export const UNAVAILABLE_CATALOG: CatalogApi = {
  list: unreachable,
  get: unreachable,
  install: unreachable,
  uninstall: unreachable,
  installed: () => [],
  downloads: () => [],
  pause: unreachable,
  resume: unreachable,
  cancel: unreachable,
};

/** Launcher catalog and download channels (FR-CAT-3..7, US-E1..E3). */
export function createCatalogHandlers(catalog: CatalogApi): Pick<IpcHandlers, CatalogChannel> {
  return {
    'catalog.list': (query) => catalog.list(query),
    'catalog.get': ({ itemId }) => catalog.get(itemId),
    'catalog.install': ({ itemId }) => catalog.install(itemId),
    'catalog.uninstall': ({ itemId, confirm }) => catalog.uninstall(itemId, confirm),
    'catalog.installed': () => catalog.installed(),
    'downloads.list': () => catalog.downloads(),
    'downloads.pause': ({ downloadId }) => catalog.pause(downloadId),
    'downloads.resume': ({ downloadId }) => catalog.resume(downloadId),
    'downloads.cancel': ({ downloadId }) => catalog.cancel(downloadId),
  };
}
