// Walk rules ported from NextLevelOS electron/romScan.cjs @ 3d530b7.
import { readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { FoundGame } from '../library/LibraryRepository.ts';
import { groupDiscs } from './discs.ts';
import { PLAYLIST_EXTENSIONS, playlistReferences } from './playlists.ts';
import type { WalkJob, WalkResult } from './types.ts';

interface Candidate {
  relPath: string;
  fullPath: string;
}

const extensionOf = (name: string) => extname(name).toLowerCase().replace(/^\./, '');
const pathKey = (path: string) => resolve(path).toLowerCase();

async function entries(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** Files in the system folder and one sub-folder level, skipping the `media` art folder. */
async function listFolder(dir: string): Promise<Candidate[] | null> {
  const top = await entries(dir);
  if (!top) return null;
  const found: Candidate[] = [];
  for (const entry of top) {
    const fullPath = join(dir, entry.name);
    if (!entry.isDirectory()) {
      found.push({ relPath: entry.name, fullPath });
      continue;
    }
    if (entry.name.toLowerCase() === 'media') continue;
    for (const sub of (await entries(fullPath)) ?? []) {
      if (!sub.isDirectory()) {
        found.push({ relPath: `${entry.name}/${sub.name}`, fullPath: join(fullPath, sub.name) });
      }
    }
  }
  return found;
}

/** Accepted files of one location, minus files a .cue/.m3u in the same location refers to. */
async function scanLocation(
  dir: string,
  locationId: string,
  accepted: ReadonlySet<string>,
): Promise<FoundGame[] | null> {
  const listed = await listFolder(dir);
  if (!listed) return null;
  const roms = listed.filter((file) => accepted.has(extensionOf(file.relPath)));
  const referenced = new Set<string>();
  for (const file of roms) {
    if (!PLAYLIST_EXTENSIONS.has(extensionOf(file.relPath))) continue;
    for (const ref of await playlistReferences(file.fullPath)) referenced.add(pathKey(ref));
  }
  const games: FoundGame[] = [];
  for (const file of roms) {
    if (referenced.has(pathKey(file.fullPath))) continue;
    try {
      const info = await stat(file.fullPath);
      if (!info.isFile()) continue;
      games.push({
        relPath: file.relPath,
        locationId,
        size: info.size,
        mtime: Math.trunc(info.mtimeMs),
        discGroup: null,
      });
    } catch {
      // Vanished or unreadable between listing and stat: not a game in this scan.
    }
  }
  return games;
}

/**
 * Finds a system's games across storage locations (FR-LIB-1, FR-LIB-3): the first location that
 * holds a rel_path wins, and multi-disc sets collapse into one game (FR-LIB-5).
 */
export async function walkSystem(job: WalkJob): Promise<WalkResult> {
  const accepted = new Set(job.extensions);
  const byKey = new Map<string, FoundGame>();
  let foldersFound = 0;
  for (const { locationId, dir } of job.dirs) {
    const games = await scanLocation(dir, locationId, accepted);
    if (!games) continue;
    foldersFound += 1;
    for (const game of games) {
      const key = game.relPath.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, game);
    }
  }
  return { systemId: job.systemId, files: groupDiscs([...byKey.values()]), foldersFound };
}
