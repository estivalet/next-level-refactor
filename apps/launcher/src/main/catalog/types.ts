import type { CatalogItem, FileRole } from '@nextlevel/shared';

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
