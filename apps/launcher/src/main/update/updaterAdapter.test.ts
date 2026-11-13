import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NsisUpdater } from 'electron-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindUpdater,
  createUpdaterAdapter,
  installKind,
  type UpdaterEvent,
} from './updaterAdapter.ts';

const fakeApp = {
  getVersion: () => '0.10.0',
  getName: () => 'NextLevel',
  isPackaged: true,
  getAppPath: () => 'x',
  getPath: (name: string) => (name === 'userData' ? join('E:', 'NextLevel', 'data') : 'nope'),
};

describe('updater adapter (NFR-UPD-1, D50)', () => {
  it('updaterAdapter: cache paths are under <data>\\updates', () => {
    const data = join('E:', 'NextLevel', 'data');
    const adapter = createUpdaterAdapter(data, fakeApp);
    expect(adapter.baseCachePath).toBe(join(data, 'updates'));
    expect(adapter.userDataPath).toBe(data);
    expect(adapter.version).toBe('0.10.0');
  });
});

describe('installKind (D51)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nextlevel-install-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('installKind: zip copy without the uninstaller → unsupported zip', () => {
    expect(installKind(dir)).toBe('zip');
  });

  it('installKind: the NSIS uninstaller beside the exe → nsis', async () => {
    await writeFile(join(dir, 'Uninstall NextLevel.exe'), '');
    expect(installKind(dir)).toBe('nsis');
  });
});

describe('bindUpdater (D53)', () => {
  function fakeUpdater() {
    return Object.assign(new EventEmitter(), {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      allowPrerelease: false,
      checkForUpdates: vi.fn(() => Promise.resolve(null)),
      quitAndInstall: vi.fn(),
    });
  }

  it('downloads in the background and installs on quit; restart is silent and starts again', () => {
    const updater = fakeUpdater();
    const port = bindUpdater(updater as unknown as NsisUpdater);
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    port.setPrerelease(true);
    expect(updater.allowPrerelease).toBe(true);
    port.quitAndInstall();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('maps electron-updater events to service events', () => {
    const updater = fakeUpdater();
    const events: UpdaterEvent[] = [];
    bindUpdater(updater as unknown as NsisUpdater).subscribe((event) => events.push(event));
    const error = new Error('boom');
    updater.emit('checking-for-update');
    updater.emit('update-available', { version: '1.0.1' });
    updater.emit('download-progress', { percent: 12.6 });
    updater.emit('update-downloaded', { version: '1.0.1' });
    updater.emit('update-not-available', { version: '0.10.0' });
    updater.emit('error', error);
    expect(events).toEqual([
      { type: 'checking' },
      { type: 'available', version: '1.0.1' },
      { type: 'progress', percent: 12.6 },
      { type: 'downloaded', version: '1.0.1' },
      { type: 'none' },
      { type: 'error', error },
    ]);
  });

  it('a failed check settles quietly; the error event is what reports it', async () => {
    const updater = fakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('offline'));
    await expect(bindUpdater(updater as unknown as NsisUpdater).check()).resolves.toBeUndefined();
  });
});
