import type { FoundGame } from '../library/LibraryRepository.ts';

/** One system to walk: its folder in each storage location, in priority order. */
export interface WalkJob {
  systemId: string;
  dirs: Array<{ locationId: string; dir: string }>;
  extensions: string[];
}

/**
 * The games found for a system; `foldersFound` counts locations where its folder exists, and
 * `unreadable` lists folders that exist but could not be read (not ENOENT).
 */
export interface WalkResult {
  systemId: string;
  files: FoundGame[];
  foldersFound: number;
  unreadable: string[];
}
