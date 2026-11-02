import type { FoundGame } from '../library/LibraryRepository.ts';
import type { MediaFile } from './media.ts';

/** One system to walk: its folder in each storage location, in priority order. */
export interface WalkJob {
  systemId: string;
  dirs: Array<{ locationId: string; dir: string }>;
  extensions: string[];
  /** Per-system walk rules from the catalog (sub-folders skipped, names never games). */
  scan?: { topLevelOnly?: boolean | undefined; ignore?: string[] | undefined } | undefined;
  /** Central mode (FR-SCR-4): `<central>/<systemId>`, holding `<kind>/` folders; indexed first. */
  centralMediaDir?: string;
}

/**
 * The games and media files found for a system; `foldersFound` counts locations where its folder exists, and
 * `unreadable` lists folders that exist but could not be read (not ENOENT).
 */
export interface WalkResult {
  systemId: string;
  files: FoundGame[];
  /** Files under each location's `media/<kind>/` folders, in location priority order. */
  media: MediaFile[];
  foldersFound: number;
  unreadable: string[];
}
