import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from '../fs/atomicWrite.ts';
import { imageType } from '../scraper/sniff.ts';
import { isPublicHttpsUrl } from './publicHost.ts';

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
const DEFAULT_MAX_CACHE_BYTES = 200 * 1024 * 1024;
const MAX_FAILURES_REMEMBERED = 1000;
const MAX_REDIRECTS = 5;

/**
 * Museum model images (FR-MUS-4): the renderer CSP blocks remote images, so main fetches each one
 * once, keeps it on disk as `<sha256(url)>.<ext>` and serves it as `nextlevel://remote-image/...`.
 * A failure is remembered in memory for 24 h so a dead link is not retried on every render.
 * Only public https hosts are fetched (see `isPublicHttpsUrl`), redirects are followed by hand and
 * checked at every hop, requests carry no cookies and the URL is never logged. The cache folder is
 * capped (oldest files go first) and so is the failure memory.
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
      /** Total size of the cache folder before the oldest files are deleted; 200 MiB. */
      maxCacheBytes?: number;
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
      this.rememberFailure(url);
      return null;
    }
    this.failedUntil.delete(url);
    try {
      await mkdir(this.deps.dir, { recursive: true });
      await atomicWrite(this.file(url, fetched.mime), fetched.bytes);
      await this.prune();
    } catch {
      // Still served this once; the next request tries to cache it again.
    }
    return fetched;
  }

  private rememberFailure(url: string): void {
    const now = this.deps.now();
    for (const [key, until] of this.failedUntil) {
      if (until <= now) this.failedUntil.delete(key);
    }
    this.failedUntil.set(url, now + FAILURE_MEMORY_MS);
    for (const key of this.failedUntil.keys()) {
      if (this.failedUntil.size <= MAX_FAILURES_REMEMBERED) break;
      this.failedUntil.delete(key); // oldest first: a Map keeps insertion order
    }
  }

  /** Deletes the oldest files (by mtime) until the folder is back under its cap. */
  private async prune(): Promise<void> {
    const cap = this.deps.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES;
    const files = await Promise.all(
      (await readdir(this.deps.dir)).map(async (name) => {
        const path = join(this.deps.dir, name);
        const info = await stat(path);
        return { path, size: info.size, mtime: info.mtimeMs };
      }),
    );
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((a, b) => a.mtime - b.mtime)) {
      if (total <= cap) break;
      await rm(file.path, { force: true });
      total -= file.size;
    }
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
      const response = await fetchHops(url, this.deps.fetcher, controller.signal);
      if (!response) return null;
      if (!response.ok) return null;
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

/** The final non-redirect response; every hop must be public https, at most 5 hops. */
async function fetchHops(
  url: string,
  fetcher: typeof fetch,
  signal: AbortSignal,
): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicHttpsUrl(current)) return null;
    const response = await fetcher(current, { redirect: 'manual', credentials: 'omit', signal });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);
    if (!location) return null;
    try {
      current = new URL(location, current).href;
    } catch {
      return null;
    }
  }
  return null;
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
