import { AppErrorException } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { CatalogClient } from './CatalogClient.ts';

function client(deviceId: string | null = 'dev-1') {
  const request = vi.fn<(...args: unknown[]) => Promise<unknown>>(() =>
    Promise.resolve({ items: [], nextCursor: null }),
  );
  const session = {
    accessCall: <T>(call: (token: string) => Promise<T>) => call('access-token'),
    deviceId: () => deviceId,
  };
  return { request, catalog: new CatalogClient({ request } as never, session) };
}

describe('catalog API client (FR-CAT-1, FR-CAT-6)', () => {
  it('lists with the query in the URL and the access token', async () => {
    const { request, catalog } = client();
    await catalog.list({ system: 'nintendo-nes', q: 'star hopper', starter: undefined });
    expect(request.mock.calls[0]?.[1]).toBe('/v1/catalog/items?system=nintendo-nes&q=star+hopper');
    expect(request.mock.calls[0]?.[3]).toEqual({ access: 'access-token' });
  });

  it("asks for download URLs for this PC's device", async () => {
    const { request, catalog } = client();
    await catalog.downloads('i/1');
    expect(request.mock.calls[0]?.slice(0, 2)).toEqual([
      'POST',
      '/v1/catalog/items/i%2F1/downloads',
    ]);
    expect(request.mock.calls[0]?.[3]).toEqual({
      access: 'access-token',
      body: { deviceId: 'dev-1' },
    });
  });

  it('without a session there is no device: API_UNREACHABLE, nothing sent', async () => {
    const { request, catalog } = client(null);
    const error = await catalog.downloads('i1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppErrorException);
    expect((error as AppErrorException).error.code).toBe('API_UNREACHABLE');
    expect(request).not.toHaveBeenCalled();
  });
});
