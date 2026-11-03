import { Unzip, UnzipInflate } from 'fflate';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/** One record of LaunchBox's Metadata.xml (FR-SCR-6); ids are its `DatabaseID`. */
export type LbRecord =
  | {
      kind: 'game';
      id: number;
      name: string;
      platform: string;
      year: number | null;
      developer: string | null;
      publisher: string | null;
      genres: string | null;
      players: string | null;
      overview: string | null;
      /** CommunityRating 0–5, one decimal (the library's scale). */
      rating: number | null;
    }
  | { kind: 'alternate'; id: number; name: string }
  | { kind: 'image'; id: number; fileName: string; type: string; region: string | null };

export type LbGame = Omit<Extract<LbRecord, { kind: 'game' }>, 'kind'>;
export interface LbImage {
  fileName: string;
  type: string;
  region: string | null;
}

type Block = 'Game' | 'GameAlternateName' | 'GameImage';
const OPEN = /<(Game|GameAlternateName|GameImage)>/g;
/** The longest opening tag, kept across chunks so a split tag is still found. */
const KEEP = '<GameAlternateName>'.length;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function fields(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, tag = '', value = ''] of block.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) {
    found.set(tag, decode(value).trim());
  }
  return found;
}

const text = (value: string | undefined): string | null =>
  value === undefined || value === '' ? null : value;

function toRecord(kind: Block, block: string): LbRecord | null {
  const f = fields(block);
  const id = Number(f.get('DatabaseID'));
  if (!Number.isInteger(id) || id <= 0) return null;
  if (kind === 'GameAlternateName') {
    const name = text(f.get('AlternateName'));
    return name ? { kind: 'alternate', id, name } : null;
  }
  if (kind === 'GameImage') {
    const fileName = text(f.get('FileName'));
    const type = text(f.get('Type'));
    return fileName && type
      ? { kind: 'image', id, fileName, type, region: text(f.get('Region')) }
      : null;
  }
  const name = text(f.get('Name'));
  const platform = text(f.get('Platform'));
  if (!name || !platform) return null;
  const year = /^\d{4}/.exec(f.get('ReleaseDate') ?? '')?.[0] ?? f.get('ReleaseYear');
  const rating = Number.parseFloat(f.get('CommunityRating') ?? '');
  return {
    kind: 'game',
    id,
    name,
    platform,
    year: year && /^\d{4}$/.test(year) ? Number(year) : null,
    developer: text(f.get('Developer')),
    publisher: text(f.get('Publisher')),
    genres: text(f.get('Genres')),
    players: text(f.get('MaxPlayers')),
    overview: text(f.get('Overview')),
    rating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : null,
  };
}

/**
 * A streaming scanner over the flat Metadata.xml: text arrives in chunks of any size and each
 * complete `<Game>`, `<GameAlternateName>` or `<GameImage>` block becomes one record. Only the
 * block being read is kept in memory.
 */
export function scanBlocks(onRecord: (record: LbRecord) => void) {
  let buffer = '';
  const drain = () => {
    let from = 0;
    for (;;) {
      OPEN.lastIndex = from;
      const open = OPEN.exec(buffer);
      if (!open) {
        buffer = buffer.slice(Math.max(from, buffer.length - KEEP));
        return;
      }
      const kind = open[1] as Block;
      const close = `</${kind}>`;
      const end = buffer.indexOf(close, open.index);
      if (end < 0) {
        buffer = buffer.slice(open.index);
        return;
      }
      const record = toRecord(kind, buffer.slice(open.index + open[0].length, end));
      if (record) onRecord(record);
      from = end + close.length;
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      drain();
    },
    end() {
      drain();
      buffer = '';
    },
  };
}

/**
 * Streams `Metadata.xml` out of LaunchBox's Metadata.zip (never extracted to disk) and reports
 * each record. `onProgress` gets the share of the zip read so far.
 */
export async function parseMetadataZip(
  zipPath: string,
  onRecord: (record: LbRecord) => void,
  onProgress?: (share: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const size = (await stat(zipPath)).size;
  await new Promise<void>((resolve, reject) => {
    const input = createReadStream(zipPath, { highWaterMark: 1 << 20 });
    const decoder = new TextDecoder('utf-8');
    const scanner = scanBlocks(onRecord);
    let found = false;
    let done = false;
    let read = 0;
    const fail = (error: unknown) => {
      input.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const unzip = new Unzip((file) => {
      if (file.name !== 'Metadata.xml') return;
      found = true;
      file.ondata = (error, chunk, final) => {
        if (error) {
          fail(error);
          return;
        }
        scanner.push(decoder.decode(chunk, { stream: !final }));
        if (final) {
          done = true;
          scanner.end();
          input.destroy();
          resolve();
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    const onAbort = () => {
      fail(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    input.on('data', (chunk) => {
      if (signal?.aborted) return;
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      read += bytes.length;
      try {
        unzip.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length));
      } catch (error) {
        fail(error);
        return;
      }
      onProgress?.(Math.min(1, read / size));
    });
    input.on('end', () => {
      try {
        unzip.push(new Uint8Array(0), true);
      } catch (error) {
        fail(error);
        return;
      }
      if (!found) fail(new Error('Metadata.xml is not in the zip'));
      else if (!done) fail(new Error('Metadata.zip is incomplete'));
    });
    input.on('error', fail);
    input.on('close', () => {
      signal?.removeEventListener('abort', onAbort);
    });
  });
}
