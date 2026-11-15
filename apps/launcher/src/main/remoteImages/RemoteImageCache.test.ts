import { readdir } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { RemoteImageCache } from './RemoteImageCache.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const URL1 = 'https://example.com/a.png';
const DAY = 24 * 60 * 60 * 1000;
let dir: string;
let cleanup: () => Promise<void>;
let clock: number;

beforeEach(async () => {
  ({ dir, cleanup } = await tempDir('remote-images-'));
  clock = 1_000;
});
afterEach(async () => {
  await cleanup();
});

const png = (init?: ResponseInit) => new Response(new Uint8Array(PNG), init);
const make = (fetcher: typeof fetch, extra: { maxBytes?: number; timeoutMs?: number } = {}) =>
  new RemoteImageCache({ dir, fetcher, now: () => clock, ...extra });
const mockFetch = (impl: () => Promise<Response>) => vi.fn(impl) as unknown as typeof fetch;

describe('RemoteImageCache', () => {
  it('FR-MUS-4: the cache fetches once, then serves from disk', async () => {
    const fetcher = mockFetch(() => Promise.resolve(png()));
    const cache = make(fetcher);
    expect(await cache.get(URL1)).toEqual({ bytes: PNG, mime: 'image/png' });
    const throwing = mockFetch(() => Promise.reject(new Error('offline')));
    expect((await make(throwing).get(URL1))?.mime).toBe('image/png');
    expect((await cache.get(URL1))?.bytes).toEqual(PNG);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(throwing).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([expect.stringMatching(/^[0-9a-f]{64}\.png$/)]);
  });

  it('FR-MUS-4: requests ask for no credentials (records intent; Node fetch has no cookie jar)', async () => {
    const fetcher = vi.fn(() => Promise.resolve(png()));
    await make(fetcher).get(URL1);
    const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].credentials).toBe('omit');
  });

  it('FR-MUS-4: concurrent gets share one fetch', async () => {
    const fetcher = mockFetch(() => Promise.resolve(png()));
    const cache = make(fetcher);
    const [a, b] = await Promise.all([cache.get(URL1), cache.get(URL1)]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  const cases: [string, () => Promise<Response>, { maxBytes?: number; timeoutMs?: number }][] = [
    ['non-image', () => Promise.resolve(new Response('<html></html>')), {}],
    ['oversize', () => Promise.resolve(png()), { maxBytes: 3 }],
    [
      'oversize-by-header',
      () => Promise.resolve(png({ headers: { 'content-length': '999999' } })),
      { maxBytes: 100 },
    ],
    ['non-OK', () => Promise.resolve(png({ status: 404 })), {}],
    ['network-error', () => Promise.reject(new Error('down')), {}],
    ['timed-out', () => new Promise<Response>(() => undefined), { timeoutMs: 10 }],
  ];
  it.each(cases)(
    'FR-MUS-4: a %s response returns null and is not retried within 24 h',
    async (_name, impl, extra) => {
      const fetcher = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
            impl().then(resolve, reject);
          }),
      );
      const cache = make(fetcher as unknown as typeof fetch, extra);
      expect(await cache.get(URL1)).toBeNull();
      expect(await cache.get(URL1)).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
      clock += DAY + 1;
      expect(await cache.get(URL1)).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it('FR-MUS-4: loopback, private and .local hosts are refused without a request', async () => {
    const fetcher = mockFetch(() => Promise.resolve(png()));
    const cache = make(fetcher);
    for (const url of [
      'https://127.0.0.1:8443/a.png',
      'https://192.168.1.5/a.png',
      'https://localhost/a.png',
      'https://nas.local/a.png',
      'https://[::1]/a.png',
      'https://user:pw@example.com/a.png',
      'http://example.com/a.png',
    ]) {
      expect(await cache.get(url), url).toBeNull();
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([]);
  });

  it('FR-MUS-4: a redirect to a private host or to http is refused', async () => {
    for (const location of [
      'http://example.com/a.png',
      'https://192.168.0.1/a.png',
      'https://127.0.0.1/a.png',
    ]) {
      const fetcher = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 302, headers: { location } })),
      );
      const cache = make(fetcher);
      expect(await cache.get(URL1), location).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('FR-MUS-4: a public https redirect is followed, but only five hops', async () => {
    const hops = vi.fn((url: string) => {
      const n = Number(/hop(\d+)/.exec(url)?.[1] ?? 0);
      return Promise.resolve(
        n < 3
          ? new Response(null, { status: 301, headers: { location: `/hop${String(n + 1)}` } })
          : png(),
      );
    });
    expect((await make(hops as unknown as typeof fetch).get(URL1))?.mime).toBe('image/png');
    expect(hops).toHaveBeenCalledTimes(4);

    const loop = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 302, headers: { location: '/again' } })),
    );
    expect(await make(loop as unknown as typeof fetch).get('https://example.com/x')).toBeNull();
    expect(loop).toHaveBeenCalledTimes(6);
  });

  it('FR-MUS-4: the cache stays under its size cap (oldest evicted)', async () => {
    const size = PNG.length;
    const cache = new RemoteImageCache({
      dir,
      fetcher: mockFetch(() => Promise.resolve(png())),
      now: () => clock,
      maxCacheBytes: size * 2,
    });
    for (const name of ['a', 'b', 'c']) {
      await cache.get(`https://example.com/${name}.png`);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    expect(await readdir(dir)).toHaveLength(2);
    const throwing = mockFetch(() => Promise.reject(new Error('offline')));
    const again = make(throwing, {});
    expect(await again.get('https://example.com/c.png')).not.toBeNull();
    expect(await again.get('https://example.com/a.png')).toBeNull(); // evicted, offline
  });

  it('FR-MUS-4: the failure memory is capped', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('down')));
    const cache = make(fetcher);
    for (let i = 0; i < 1005; i++) await cache.get(`https://example.com/${String(i)}.png`);
    expect((cache as unknown as { failedUntil: Map<string, number> }).failedUntil.size).toBe(1000);
  });
});
