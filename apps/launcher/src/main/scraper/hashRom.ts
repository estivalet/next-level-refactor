import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { crc32 } from 'node:zlib';

export interface RomHashes {
  size: number;
  /** 8 lowercase hex digits. */
  crc: string;
  md5: string;
  sha1: string;
}

/** Playlists and sheets describe other files; hashing them identifies nothing. */
const NO_HASH = new Set(['.m3u', '.cue', '.gdi']);
const MAX_BYTES = 512 * 1024 * 1024;

/**
 * The hashes ScreenScraper identifies a ROM by, or null when the file is not worth hashing:
 * missing, not a file, a playlist/sheet, or `maxBytes` (512 MiB) or larger
 * (ported from NextLevelOS scrappers/scrape_cli.py should_hash @ 3d530b7).
 */
export async function hashRom(
  path: string,
  opts: { maxBytes?: number } = {},
): Promise<RomHashes | null> {
  if (NO_HASH.has(extname(path).toLowerCase())) return null;
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size >= (opts.maxBytes ?? MAX_BYTES)) return null;
  const md5 = createHash('md5');
  const sha1 = createHash('sha1');
  let crc = 0;
  let size = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 4 * 1024 * 1024 })) {
    const bytes = chunk as Buffer;
    crc = crc32(bytes, crc);
    md5.update(bytes);
    sha1.update(bytes);
    size += bytes.length;
  }
  return {
    size,
    crc: crc.toString(16).padStart(8, '0'),
    md5: md5.digest('hex'),
    sha1: sha1.digest('hex'),
  };
}
