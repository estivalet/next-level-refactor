import { orderedLocations, type StorageLocation } from '@nextlevel/shared';
import { readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative } from 'node:path';
import type { DeleteLaterGame } from '../library/GameExportReader.ts';
import { DISC_PATTERN, normalizeDiscName } from '../scan/discs.ts';
import { PLAYLIST_EXTENSIONS, playlistReferences } from '../scan/playlists.ts';

/** One line of the cleanup script: a file (or a game folder) to send to the Recycle Bin. */
export interface CleanupFile {
  path: string;
  /** The storage location's name. */
  location: string;
  /** Bytes; 0 for a folder (its contents aren't walked). */
  size: number;
  folder: boolean;
}

/** A Delete later game and what the script does with it (FR-LIB-20). */
export interface CleanupGame {
  title: string;
  system: string;
  files: CleanupFile[];
  /** Written as comments only: Catalog copies, playlist entries outside the system folder. */
  notes: CleanupNote[];
}

export interface CleanupNote {
  kind: 'catalog' | 'outside';
  path: string;
}

export interface CleanupDeps {
  /** Searched in list order (FR-LIB-1). */
  locations: readonly StorageLocation[];
  /** The system's folder name inside a location (as `expectedGamePath` resolves it). */
  folderName: (systemId: string) => string;
}

type Found = { kind: 'file'; size: number } | { kind: 'folder' } | null;

async function lookup(path: string): Promise<Found> {
  try {
    const info = await stat(path);
    if (info.isDirectory()) return { kind: 'folder' };
    return info.isFile() ? { kind: 'file', size: info.size } : null;
  } catch {
    return null;
  }
}

/** Windows paths ignore case. */
const pathKey = (path: string) => path.toLowerCase();

function isInside(dir: string, path: string): boolean {
  const rel = relative(dir, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

const stemOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

/** The other discs of a loose disc set in `dir`, by name (FR-LIB-5 rules). */
async function discSiblings(dir: string, discGroup: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const group = discGroup.toLowerCase();
  return names
    .filter((name) => {
      const stem = stemOf(name);
      return DISC_PATTERN.test(stem) && normalizeDiscName(stem).toLowerCase() === group;
    })
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(dir, name));
}

/**
 * Finds every file of each Delete later game in every storage location (FR-LIB-20, US-C14):
 * playlists bring the files they name (inside the system folder only), disc sets their other
 * discs, and a game folder is one entry. Catalog (managed) copies become notes. Read-only; a file
 * reached twice is listed once.
 */
export async function collectCleanupFiles(
  games: readonly DeleteLaterGame[],
  deps: CleanupDeps,
): Promise<CleanupGame[]> {
  const seen = new Set<string>();
  const result: CleanupGame[] = [];
  for (const game of games) {
    const entry: CleanupGame = { title: game.title, system: game.system, files: [], notes: [] };
    for (const location of orderedLocations(deps.locations)) {
      const systemDir = join(location.path, deps.folderName(game.systemId));
      const main = join(systemDir, ...game.relPath.split('/'));
      if (location.managed) {
        if (await lookup(main)) entry.notes.push({ kind: 'catalog', path: main });
        continue;
      }
      const add = async (path: string): Promise<void> => {
        if (seen.has(pathKey(path))) return;
        const found = await lookup(path);
        if (!found) return;
        seen.add(pathKey(path));
        entry.files.push({
          path,
          location: location.name,
          size: found.kind === 'file' ? found.size : 0,
          folder: found.kind === 'folder',
        });
        if (found.kind !== 'file') return;
        if (!PLAYLIST_EXTENSIONS.has(extname(path).slice(1).toLowerCase())) return;
        for (const ref of await playlistReferences(path)) {
          if (isInside(systemDir, ref)) await add(ref);
          else if (!seen.has(pathKey(ref)) && (await lookup(ref))) {
            seen.add(pathKey(ref));
            entry.notes.push({ kind: 'outside', path: ref });
          }
        }
      };
      await add(main);
      if (game.discGroup) {
        const dir = join(main, '..');
        for (const disc of await discSiblings(dir, game.discGroup)) await add(disc);
      }
    }
    result.push(entry);
  }
  return result;
}
