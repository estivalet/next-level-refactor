import { AppErrorException, ERROR_CODES } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createIpcRouter } from '../ipc/router.ts';
import { withUnimplemented } from '../ipc/withUnimplemented.ts';
import { createCatalogHandlers, UNAVAILABLE_CATALOG, type CatalogApi } from './catalogHandlers.ts';

function router(api: Partial<CatalogApi>) {
  const calls: unknown[] = [];
  const handlers = createCatalogHandlers({ ...UNAVAILABLE_CATALOG, ...api });
  return {
    calls,
    router: createIpcRouter(withUnimplemented(handlers), { error: () => undefined }),
  };
}

describe('catalog IPC handlers (FR-CAT-3..7, US-E3)', () => {
  it('validate input before calling the catalog', async () => {
    const calls: unknown[] = [];
    const { router: r } = router({
      uninstall: (itemId, confirm) => {
        calls.push([itemId, confirm]);
        return Promise.resolve();
      },
    });
    expect(await r.handle('catalog.uninstall', { itemId: '' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(await r.handle('catalog.uninstall', { itemId: 'i1' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await r.handle('downloads.pause', { id: 'd1' })).toMatchObject({ ok: false });
    expect(calls).toEqual([['i1', false]]);
  });

  it('map catalog errors to their codes and details', async () => {
    const { router: r } = router({
      uninstall: () =>
        Promise.reject(
          new AppErrorException({
            code: 'CONFLICT',
            message: ERROR_CODES.CONFLICT,
            details: { reason: 'inCollections' },
          }),
        ),
    });
    expect(await r.handle('catalog.uninstall', { itemId: 'i1' })).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', details: { reason: 'inCollections' } },
    });
  });

  it('with the catalog unavailable, API calls are API_UNREACHABLE and nothing is installed', async () => {
    const { router: r } = router({});
    expect(await r.handle('catalog.list', {})).toMatchObject({
      ok: false,
      error: { code: 'API_UNREACHABLE' },
    });
    expect(await r.handle('catalog.installed', undefined)).toEqual({ ok: true, value: [] });
    expect(await r.handle('downloads.list', undefined)).toEqual({ ok: true, value: [] });
  });
});
