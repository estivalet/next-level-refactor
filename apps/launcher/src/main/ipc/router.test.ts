import { AppErrorException, ipcContract } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { withUnimplemented } from './withUnimplemented.ts';
import { createIpcRouter, type IpcHandlers, type RouterLogger } from './router.ts';

function setup(appVersion: IpcHandlers['app.version']) {
  const logError = vi.fn<RouterLogger['error']>();
  const handler = vi.fn(appVersion);
  const router = createIpcRouter(withUnimplemented({ 'app.version': handler }), {
    error: logError,
  });
  return { router, handler, logError };
}

describe('createIpcRouter', () => {
  it('NFR-MAINT-1: valid call returns ok with the handler value', async () => {
    const { router } = setup(() => '1.2.3');
    await expect(router.handle('app.version', undefined)).resolves.toEqual({
      ok: true,
      value: '1.2.3',
    });
  });

  it('NFR-MAINT-1: invalid input returns VALIDATION_FAILED without calling the handler', async () => {
    const { router, handler } = setup(() => '1.2.3');
    const result = await router.handle('app.version', { x: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.details).toEqual(expect.arrayContaining([expect.any(Object)]));
    expect(handler).not.toHaveBeenCalled();
  });

  it('NFR-MAINT-1: a throwing handler returns INTERNAL and is logged', async () => {
    const { router, logError } = setup(() => {
      throw new Error('secret stack');
    });
    const result = await router.handle('app.version', undefined);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
    expect(JSON.stringify(result)).not.toContain('secret stack');
    expect(logError).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'app.version' }),
      expect.any(String),
    );
  });

  it('NFR-MAINT-1: output that breaks the contract returns INTERNAL', async () => {
    const { router } = setup(() => 42 as unknown as string);
    const result = await router.handle('app.version', undefined);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
  });

  it('NFR-MAINT-1: channels lists every contract key', () => {
    const { router } = setup(() => '1.2.3');
    expect(router.channels).toEqual(Object.keys(ipcContract));
  });
});

describe('createIpcRouter with AppErrorException', () => {
  it('NFR-MAINT-1: a handler that throws AppErrorException returns that error', async () => {
    const router = createIpcRouter(
      withUnimplemented({
        'app.version': () => {
          throw new AppErrorException({ code: 'CONFLICT', message: 'errors.conflict' });
        },
      }),
      { error: () => undefined },
    );
    expect(await router.handle('app.version', undefined)).toEqual({
      ok: false,
      error: { code: 'CONFLICT', message: 'errors.conflict' },
    });
  });
});
