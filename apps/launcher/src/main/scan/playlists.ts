// Ported from NextLevelOS electron/romScan.cjs @ 3d530b7.
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

/** Playlist formats whose referenced files are part of the same game (FR-LIB-5). */
export const PLAYLIST_EXTENSIONS = new Set(['cue', 'm3u']);
const MAX_PLAYLIST_BYTES = 256 * 1024;
const BOM = String.fromCharCode(0xfeff);

/** Absolute paths referenced by a .cue (`FILE "x.bin" …`) or .m3u (one entry per line). */
export async function playlistReferences(playlistPath: string): Promise<string[]> {
  let text: string;
  try {
    if ((await stat(playlistPath)).size > MAX_PLAYLIST_BYTES) return [];
    text = await readFile(playlistPath, 'utf8');
  } catch {
    return [];
  }
  const dir = dirname(playlistPath);
  const isCue = extname(playlistPath).toLowerCase() === '.cue';
  const refs: string[] = [];
  for (const line of text.replace(BOM, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    let ref: string | undefined;
    if (isCue) {
      const match = /^FILE\s+(?:"([^"]+)"|(\S+))/i.exec(trimmed);
      ref = match?.[1] ?? match?.[2];
    } else if (trimmed && !trimmed.startsWith('#')) {
      ref = trimmed;
    }
    // A leading "\" or "/" ("\content\game.iso") is relative to the playlist folder, not the drive.
    if (ref) refs.push(resolve(dir, ref.replace(/^[\\/]+/, '')));
  }
  return refs;
}
