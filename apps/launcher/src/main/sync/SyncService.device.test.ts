import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LaunchRepository } from '../library/LaunchRepository.ts';
import { seedGames } from '../library/testing.ts';
import { fakeSyncServer, syncPc } from './testing.ts';

// D64: a portable NextLevel folder copied to another PC must not share this PC's play counter.

const T = new Date('2026-11-13T12:00:00.000Z');
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function pc(server: ReturnType<typeof fakeSyncServer>, host: string) {
  const made = await syncPc(server, { hostId: () => host });
  cleanups.push(made.cleanup);
  return made;
}

describe('one device key per PC (D64, FR-SET-5)', () => {
  it('D64: a portable folder copied to another PC gets its own device key, and plays on both PCs add up', async () => {
    const server = fakeSyncServer();
    const a = await pc(server, 'aaaaaaaaaaaaaaaa');
    const [aGame = 0] = seedGames(a.db, 'snes', ['Mario']);
    await a.service.setEnabled(true);
    new LaunchRepository(a.db).recordPlay(aGame, 10, T);
    await a.service.sync();

    // The copy: same settings.sync, same sync.json, the same library state (one play).
    const b = await pc(server, 'bbbbbbbbbbbbbbbb');
    const [bGame = 0] = seedGames(b.db, 'snes', ['Mario']);
    new LaunchRepository(b.db).recordPlay(bGame, 10, T);
    b.setSettings({ ...b.settings(), sync: a.settings().sync });
    await copyFile(join(a.dir, 'sync.json'), join(b.dir, 'sync.json'));

    new LaunchRepository(b.db).recordPlay(bGame, 10, T);
    await b.service.sync();
    new LaunchRepository(a.db).recordPlay(aGame, 10, T);
    await a.service.sync();
    await b.service.sync();

    expect(b.settings().sync.deviceKey).not.toBe(a.settings().sync.deviceKey);
    expect(b.settings().sync.deviceHost).toBe('bbbbbbbbbbbbbbbb');
    expect(a.state(aGame)?.playCount).toBe(3);
    expect(b.state(bGame)?.playCount).toBe(3);
  });

  it('D64: a PC that synced before deviceHost existed keeps its key', async () => {
    const server = fakeSyncServer();
    const a = await pc(server, 'aaaaaaaaaaaaaaaa');
    await a.service.setEnabled(true);
    const key = a.settings().sync.deviceKey;
    a.setSettings({ ...a.settings(), sync: { enabled: true, deviceKey: key, deviceHost: null } });
    await a.service.sync();
    expect(a.settings().sync).toEqual({
      enabled: true,
      deviceKey: key,
      deviceHost: 'aaaaaaaaaaaaaaaa',
    });
  });
});
