import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../fs/atomicWrite.ts';
import { imageType } from '../scraper/sniff.ts';

export interface RemoteImage {
  bytes: Buffer;
  mime: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const FAILURE_MEMORY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Museum model images (FR-MUS-4): the renderer CSP blocks remote images, so main fetches each one
 * once, keeps it on disk as `<sha256(url)>.<ext>` and serves it as `nextlevel://remote-image/...`.
 * A failure is remembered in memory for 24 h so a dead link is not retried on every render.
 * Requests carry no credentials and the URL is never logged. The cache is never evicted: a museum
 * holds a few hundred small images.
 */
export class RemoteImageCache {
  private readonly inflight = new Map<string, Promise<RemoteImage | null>>();
  private readonly failedUntil = new Map<string, number>();

  constructor(
    private readonly deps: {
      dir: string;
      fetcher: typeof fetch;
      now: () => number;
      maxBytes?: number;
      timeoutMs?: number;
    },
  ) {}

  get(url: string): Promise<RemoteImage | null> {
    const failedUntil = this.failedUntil.get(url);
    if (failedUntil !== undefined && failedUntil > this.deps.now()) return Promise.resolve(null);
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const job = this.load(url).finally(() => {
      this.inflight.delete(url);
    });
    this.inflight.set(url, job);
    return job;
  }

  private async load(url: string): Promise<RemoteImage | null> {
    const cached = await this.readCached(url);
    if (cached) return cached;
    const fetched = await this.download(url);
    if (!fetched) {
      this.failedUntil.set(url, this.deps.now() + FAILURE_MEMORY_MS);
      return null;
    }
    this.failedUntil.delete(url);
    try {
      await mkdir(this.deps.dir, { recursive: true });
      await atomicWrite(this.file(url, fetched.mime), fetched.bytes);
    } catch {
      // Still served this once; the next request tries to cache it again.
    }
    return fetched;
  }

  private file(url: string, mime: string): string {
    const hash = createHash('sha256').update(url).digest('hex');
    return join(this.deps.dir, `${hash}.${EXTENSIONS[mime] ?? 'bin'}`);
  }

  private async readCached(url: string): Promise<RemoteImage | null> {
    for (const mime of Object.keys(EXTENSIONS)) {
      try {
        const bytes = await readFile(this.file(url, mime));
        const sniffed = imageType(bytes);
        if (sniffed) return { bytes, mime: sniffed };
      } catch {
        // Not cached under this extension.
      }
    }
    return null;
  }

  private async download(url: string): Promise<RemoteImage | null> {
    const maxBytes = this.deps.maxBytes ?? DEFAULT_MAX_BYTES;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.deps.fetcher(url, {
        redirect: 'follow',
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) return null;
      // A redirect must not leave https (an empty `url` means no redirect was reported).
      if (response.url !== '' && !response.url.startsWith('https://')) return null;
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) return null;
      const bytes = await readCapped(response, maxBytes);
      const mime = bytes ? imageType(bytes) : null;
      return bytes && mime ? { bytes, mime } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The body, or null as soon as it passes `maxBytes` (the rest is not read). */
async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) {
    const all = Buffer.from(await response.arrayBuffer());
    return all.length > maxBytes ? null : all;
  }
  // Leaving the loop early cancels the stream, so an oversize body is not read to the end.
  const body = response.body as unknown as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
