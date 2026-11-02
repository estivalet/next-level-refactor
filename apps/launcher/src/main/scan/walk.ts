// Walk rules ported from NextLevelOS electron/romScan.cjs @ 3d530b7.
import { readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { FoundGame } from '../library/LibraryRepository.ts';
import { groupDiscs } from './discs.ts';
import type { MediaFile } from './media.ts';
import { PLAYLIST_EXTENSIONS, playlistReferences } from './playlists.ts';
import type { WalkJob, WalkResult } from './types.ts';

interface Candidate {
  relPath: string;
  fullPath: string;
}

const extensionOf = (name: string) => extname(name).toLowerCase().replace(/^\./, '');

/** How one system's folder is walked (WalkJob.scan, FR-LIB-1). */
interface WalkRules {
  accepted: ReadonlySet<string>;
  topLevelOnly: boolean;
  /** Names that are never games: `*` matches any characters, case-insensitive. */
  ignore: RegExp[];
}

function namePattern(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function walkRules(job: WalkJob): WalkRules {
  return {
    accepted: new Set(job.extensions),
    topLevelOnly: job.scan?.topLevelOnly ?? false,
    ignore: (job.scan?.ignore ?? []).map(namePattern),
  };
}
const pathKey = (path: string) => resolve(path).toLowerCase();

async function entries(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** A folder that isn't there (ENOENT) is normal; any other failure is worth a log line. */
class UnreadableFolder extends Error {}

async function topEntries(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new UnreadableFolder(dir);
  }
}

/**
 * Group folders (`! Hacks`, `+AGS`, `#2003`: a name starting with `!`, `+` or `#`) are searched
 * up to this many folder levels; other sub-folders one level, as NextLevelOS scanned. NextLevelOS
 * gamelists keep curated sets up to 9 levels deep under group folders (`! Hacks/! Hacks-SMW/…`),
 * while other deep trees are support files (MAME software lists, game assets).
 */
const GROUP_FOLDER_DEPTH = 10;
const GROUP_FOLDER = /^[!+#]/;

/**
 * Files in the system folder and its sub-folders, skipping the top-level `media` art folder.
 * Links and junctions are not followed (Dirent reports them as links, not folders), so a loop
 * can't happen.
 */
async function listFolder(dir: string, rules: WalkRules): Promise<Candidate[] | null> {
  const top = await topEntries(dir);
  if (!top) return null;
  const found: Candidate[] = [];
  const visit = async (
    list: Awaited<ReturnType<typeof entries>>,
    folder: string,
    prefix: string,
    depth: number,
    maxDepth: number,
  ): Promise<void> => {
    for (const entry of list ?? []) {
      const fullPath = join(folder, entry.name);
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (rules.ignore.some((pattern) => pattern.test(entry.name))) continue;
      if (!entry.isDirectory() || rules.accepted.has(extensionOf(entry.name))) {
        // A folder with a game extension (`maddog-hd.hypseus`) is one game, not walked into.
        found.push({ relPath, fullPath });
      } else if (rules.topLevelOnly) {
        continue;
      } else if (depth === 0) {
        if (entry.name.toLowerCase() === 'media') continue;
        const limit = GROUP_FOLDER.test(entry.name) ? GROUP_FOLDER_DEPTH : 1;
        await visit(await entries(fullPath), fullPath, relPath, 1, limit);
      } else if (depth < maxDepth) {
        await visit(await entries(fullPath), fullPath, relPath, depth + 1, maxDepth);
      }
    }
  };
  await visit(top, dir, '', 0, 1);
  return found;
}

/** Files in `<dir>/media/<kind>/` (one level; the media folder's case is ignored). */
async function listMedia(dir: string): Promise<MediaFile[]> {
  const top = (await entries(dir)) ?? [];
  const mediaDir = top.find((entry) => entry.isDirectory() && entry.name.toLowerCase() === 'media');
  return mediaDir ? listKinds(join(dir, mediaDir.name), false) : [];
}

/** Files in `<mediaDir>/<kind>/`; a missing or unreadable folder has none. */
async function listKinds(mediaDir: string, central: boolean): Promise<MediaFile[]> {
  const found: MediaFile[] = [];
  for (const kind of (await entries(mediaDir)) ?? []) {
    if (!kind.isDirectory()) continue;
    const kindDir = join(mediaDir, kind.name);
    for (const file of (await entries(kindDir)) ?? []) {
      if (!file.isFile()) continue;
      const path = join(kindDir, file.name);
      try {
        const info = await stat(path);
        const file = { kind: kind.name, path, size: info.size, mtime: info.mtimeMs };
        found.push(central ? { ...file, central } : file);
      } catch {
        // Vanished between listing and stat.
      }
    }
  }
  return found;
}

/** Accepted files of one location, minus files a .cue/.m3u in the same location refers to. */
async function scanLocation(
  dir: string,
  locationId: string,
  rules: WalkRules,
): Promise<FoundGame[] | null> {
  const listed = await listFolder(dir, rules);
  if (!listed) return null;
  const roms = listed.filter((file) => rules.accepted.has(extensionOf(file.relPath)));
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
      if (!info.isFile() && !info.isDirectory()) continue;
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
  const rules = walkRules(job);
  const byKey = new Map<string, FoundGame>();
  // Central media first (FR-SCR-4); matchMedia also ranks it above per-ROM files.
  const media: MediaFile[] = job.centralMediaDir ? await listKinds(job.centralMediaDir, true) : [];
  let foldersFound = 0;
  const unreadable: string[] = [];
  for (const { locationId, dir } of job.dirs) {
    let games: FoundGame[] | null;
    try {
      games = await scanLocation(dir, locationId, rules);
    } catch (error) {
      if (!(error instanceof UnreadableFolder)) throw error;
      unreadable.push(dir);
      continue;
    }
    if (!games) continue;
    foldersFound += 1;
    media.push(...(await listMedia(dir)));
    for (const game of games) {
      const key = game.relPath.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, game);
    }
  }
  return {
    systemId: job.systemId,
    files: groupDiscs([...byKey.values()]),
    media,
    foldersFound,
    unreadable,
  };
}
