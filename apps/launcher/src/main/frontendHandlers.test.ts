import { AppErrorException } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { createFrontendHandlers } from './frontendHandlers.ts';

describe('front-end handlers', () => {
  it('FR-THM-6: menu and games come from the front-end service', async () => {
    const handlers = createFrontendHandlers({
      frontend: () => ({
        menu: () => ({ title: 'NextLevel', items: [] }),
        games: (nodeId) => (nodeId === 's:snes' ? [] : []),
      }),
    });
    expect(await handlers['frontend.menu']()).toEqual({ title: 'NextLevel', items: [] });
    expect(await handlers['frontend.games']({ nodeId: 's:snes' })).toEqual([]);
  });

  it('FR-THM-6: without a library the channels fail with LIBRARY_UNAVAILABLE', () => {
    const handlers = createFrontendHandlers({
      frontend: () => {
        throw new AppErrorException({ code: 'LIBRARY_UNAVAILABLE', message: 'x' });
      },
    });
    expect(() => handlers['frontend.menu']()).toThrow(AppErrorException);
  });
});
