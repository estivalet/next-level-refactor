// Ported from NextLevelOS electron/mediaRange.cjs @ 3d530b7.
//
// Chromium's media cache resumes a revisited video with a mid-file range (`bytes=34504704-`);
// answering with byte 0 makes the <video> fail, so ranged requests get a proper 206.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
};

/**
 * Parses a single `bytes=` range against a file of `size` bytes: `{ start, end }` (inclusive),
 * `'unsatisfiable'`, or null when the header is absent or not a single byte range (the whole
 * file is served).
 */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  const [, from = '', to = ''] = match ?? [];
  if (!match || (from === '' && to === '')) return null;
  if (from === '') return { start: Math.max(0, size - Number(to)), end: size - 1 };
  const start = Number(from);
  if (to !== '' && Number(to) < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end: to === '' ? size - 1 : Math.min(Number(to), size - 1) };
}

/** A 200, 206, 404 or 416 response for a file on disk. */
export async function serveFile(path: string, rangeHeader: string | null): Promise<Response> {
  let size: number;
  try {
    const info = await stat(path);
    if (!info.isFile()) return new Response(null, { status: 404 });
    size = info.size;
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers = {
    'Content-Type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  };
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${String(size)}` },
    });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  // An empty file has no byte range to stream.
  const body =
    size === 0 ? null : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream);
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...headers,
      'Content-Length': String(size === 0 ? 0 : end - start + 1),
      ...(range
        ? { 'Content-Range': `bytes ${String(start)}-${String(end)}/${String(size)}` }
        : {}),
    },
  });
}
