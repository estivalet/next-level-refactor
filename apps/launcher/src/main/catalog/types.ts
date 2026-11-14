import type { CatalogItem, FileRole } from '@nextlevel/shared';
import type { EmitEvent } from '../ipc/events.ts';
import type { DownloadRepository } from '../library/DownloadRepository.ts';
import type { CatalogClient } from './CatalogClient.ts';
import type { ItemLocks } from './itemLocks.ts';

/** A downloaded file whose size and SHA-256 matched the catalog (C9), ready to install. */
export interface VerifiedFile {
  fileId: string;
  filename: string;
  role: FileRole;
  /** The verified `.part` file; the installer moves it into place. */
  path: string;
  size: number;
  sha256: string;
}

/** Puts a downloaded item into the library (Task 15's Installer). */
export interface ItemInstaller {
  install(item: CatalogItem, files: readonly VerifiedFile[]): Promise<{ gameId: number }>;
}

export interface DownloadLog {
  info(context: Record<string, unknown>, msg: string): void;
  warn(context: object, msg: string): void;
  error(context: Record<string, unknown>, msg: string): void;
}

export interface DownloadDeps {
  repo: DownloadRepository;
  catalog: Pick<CatalogClient, 'get' | 'downloads'>;
  installer: ItemInstaller;
  /** `<data>\downloads`: one folder of `.part` files per download. */
  dir: string;
  fetch: typeof fetch;
  freeSpace?: (dir: string) => Promise<number>;
  emit: EmitEvent;
  log: DownloadLog;
  clock: () => Date;
  newId: () => string;
  locks: ItemLocks;
  /** SHA-256 of a part (tests hold it to act during verify); stops when `signal` aborts. */
  hash?: (path: string, signal: AbortSignal) => Promise<string>;
  /** Deletes a download's folder (tests make it fail). */
  removeDir?: (path: string) => Promise<void>;
}
