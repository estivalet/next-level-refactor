import { ipcContract } from '@nextlevel/shared';
import { describe, expect, it, vi } from 'vitest';
import { createRendererErrorHandler } from './rendererErrorHandler.ts';

describe('renderer crash reports (NFR-REL-2, NFR-OBS-1)', () => {
  it('NFR-REL-2: a renderer crash is written to the log with where, id and stack', async () => {
    const log = { error: vi.fn() };
    const handler = createRendererErrorHandler(log)['app.reportError'];
    await handler({ where: 'theme', id: 'arcade', message: 'boom', stack: 'Error: boom\n at x' });
    expect(log.error).toHaveBeenCalledWith(
      { where: 'theme', id: 'arcade', stack: 'Error: boom\n at x' },
      'renderer crash: boom',
    );
  });

  it('NFR-REL-2: the report names where it came from (theme, window or shell)', () => {
    const input = ipcContract['app.reportError'].input;
    expect(input.safeParse({ where: 'window', id: 'library', message: 'x' }).success).toBe(true);
    expect(input.safeParse({ where: 'other', id: 'library', message: 'x' }).success).toBe(false);
  });
});
