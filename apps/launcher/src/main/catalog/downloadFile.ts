import { open, stat, truncate } from 'node:fs/promises';
import type { ReadableStreamDefaultReader, ReadableStreamReadResult } from 'node:stream/web';

/** A disk error: the download fails (`write`) instead of waiting for the network. */
export class DiskWriteError extends Error {
  constructor(readonly code: string) {
    super(`download write failed: ${code}`);
    this.name = 'DiskWriteError';
  }
}

const EXPIRED = new Set([401, 403, 404, 410]);

function diskError(error: unknown): Error {
  const code = (error as { code?: unknown }).code;
  return new DiskWriteError(typeof code === 'string' ? code : 'EIO');
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

/**
 * Downloads one catalog file into its `.part` (FR-CAT-4, Review Focus 3), resuming from the
 * part's size with a Range request. `expired`: the files route refused the URL (re-request it);
 * `network`: the connection failed or stopped early (what arrived is kept). An abort rejects.
 * The URL carries a token: it is never logged or put in an error.
 */
export async function downloadFile(o: {
  url: string;
  part: string;
  expectedSize: number;
  fetch: typeof fetch;
  signal: AbortSignal;
  /** Bytes written since the last call. */
  onBytes?: (count: number) => void;
  /** The server sent the whole file to a ranged request: the part's `dropped` bytes are rewritten. */
  onRestart?: (dropped: number) => void;
}): Promise<'done' | 'expired' | 'network'> {
  o.signal.throwIfAborted();
  let start = await sizeOf(o.part);
  if (start > o.expectedSize) {
    await truncate(o.part, 0);
    start = 0;
  }
  if (start === o.expectedSize) return 'done';
  let response: Response;
  try {
    response = await o.fetch(o.url, {
      headers: start > 0 ? { range: `bytes=${String(start)}-` } : {},
      signal: o.signal,
    });
  } catch {
    o.signal.throwIfAborted();
    return 'network';
  }
  if (EXPIRED.has(response.status)) return 'expired';
  if (response.status === 416) {
    // The server's file is shorter than the part: start over.
    await truncate(o.part, 0);
    return 'network';
  }
  if ((response.status !== 200 && response.status !== 206) || !response.body) return 'network';
  // A whole-file answer to a ranged request rewrites the part from the start.
  const append = response.status === 206 && start > 0;
  if (!append && start > 0) o.onRestart?.(start);
  let handle;
  try {
    handle = await open(o.part, append ? 'a' : 'w');
  } catch (error) {
    throw diskError(error);
  }
  // Each chunk is on disk before the next is read, so a cut connection keeps all that arrived.
  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        o.signal.throwIfAborted();
        return 'network';
      }
      if (chunk.done) break;
      try {
        await handle.write(chunk.value);
      } catch (error) {
        throw diskError(error);
      }
      o.onBytes?.(chunk.value.byteLength);
    }
  } finally {
    await handle.close();
    reader.releaseLock();
  }
  return (await sizeOf(o.part)) >= o.expectedSize ? 'done' : 'network';
}
