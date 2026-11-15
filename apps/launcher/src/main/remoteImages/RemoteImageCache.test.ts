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

  it('FR-MUS-4: requests carry no credentials', async () => {
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

  it('FR-MUS-4: a redirect to http is refused', async () => {
    const response = png();
    Object.defineProperty(response, 'url', { value: 'http://example.com/a.png' });
    const cache = make(mockFetch(() => Promise.resolve(response)));
    expect(await cache.get(URL1)).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });
});
