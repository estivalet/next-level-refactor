import type { FoundGame } from '../library/LibraryRepository.ts';

/** One system to walk: its folder in each storage location, in priority order. */
export interface WalkJob {
  systemId: string;
  dirs: Array<{ locationId: string; dir: string }>;
  extensions: string[];
}

/** The games found for a system; `foldersFound` counts locations where its folder exists. */
export interface WalkResult {
  systemId: string;
  files: FoundGame[];
  foldersFound: number;
}
