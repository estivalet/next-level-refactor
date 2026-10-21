import { ipcContract } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { registerIpcRouter, type IpcRegistrar } from './register.ts';
import { createIpcRouter } from './router.ts';

type Handler = Parameters<IpcRegistrar['handle']>[1];

function setup() {
  const handlers = new Map<string, Handler>();
  const ipc: IpcRegistrar = { handle: (channel, handler) => handlers.set(channel, handler) };
  const router = createIpcRouter(
    { 'app.version': () => '1.2.3', 'app.quit': () => undefined },
    { error: () => undefined },
  );
  registerIpcRouter(ipc, router);
  return handlers;
}

describe('registerIpcRouter', () => {
  it('registers every contract channel', () => {
    expect([...setup().keys()]).toEqual(Object.keys(ipcContract));
  });

  it('NFR-SEC-1: extra IPC arguments return VALIDATION_FAILED', async () => {
    const handler = setup().get('app.version');
    const result: unknown = await handler?.({} as never, undefined, { x: 1 });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });

  it('passes a single argument to the router', async () => {
    const handler = setup().get('app.version');
    await expect(handler?.({} as never, undefined)).resolves.toEqual({ ok: true, value: '1.2.3' });
  });
});
