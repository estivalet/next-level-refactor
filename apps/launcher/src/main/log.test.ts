import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const electronLog = vi.hoisted(() => ({
  transports: { file: { maxSize: 0, resolvePathFn: undefined as undefined | (() => string) } },
  initialize: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('electron-log/main', () => ({ default: electronLog }));

const { initLogger, logger } = await import('./log.ts');

describe('launcher log (NFR-OBS-1, architecture §7)', () => {
  it('NFR-OBS-1: the launcher logs to <logs>/main.log and rotates at 5 MiB', () => {
    initLogger(join('C:', 'NextLevel', 'data', 'logs'));
    expect(electronLog.transports.file.resolvePathFn?.()).toBe(
      join('C:', 'NextLevel', 'data', 'logs', 'main.log'),
    );
    expect(electronLog.transports.file.maxSize).toBe(5 * 1024 * 1024);
    expect(electronLog.initialize).toHaveBeenCalledOnce();
  });

  it('NFR-OBS-1: log lines keep the message first and the structured context after it', () => {
    logger.error({ gameId: 7 }, 'launch failed');
    expect(electronLog.error).toHaveBeenCalledWith('launch failed', { gameId: 7 });
  });
});
