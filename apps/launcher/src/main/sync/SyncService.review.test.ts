import { afterEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { LaunchRepository } from '../library/LaunchRepository.ts';
import { seedGames } from '../library/testing.ts';
import { fakeSyncServer, syncPc } from './testing.ts';

// Final review of M10b-2 (FR-SET-5, D55): failures that must never corrupt synced data.

const T = '2026-11-13T12:00:00.000Z';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function pc(
  server: ReturnType<typeof fakeSyncServer>,
  opts: Parameters<typeof syncPc>[1] = {},
) {
  const made = await syncPc(server, opts);
  cleanups.push(made.cleanup);
  return made;
}

const entriesOf = (server: ReturnType<typeof fakeSyncServer>, kind: string) =>
  (server.docs.get(kind)?.data as { entries: Record<string, { value: unknown; deleted?: true }> })
    .entries;

describe('sync review fixes (FR-SET-5, D55)', () => {
  it('a write that fails after the merge was applied never inflates play counts', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const [aGame] = seedGames(a.db, 'snes', ['Mario']);
    const [bGame] = seedGames(b.db, 'snes', ['Mario']);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    const bPlays = new LaunchRepository(b.db);
    bPlays.recordPlay(bGame ?? 0, 10, new Date(T));
    bPlays.recordPlay(bGame ?? 0, 10, new Date(T));
    await b.service.sync();
    new LaunchRepository(a.db).recordPlay(aGame ?? 0, 10, new Date(T));
    server.beforePut = () => Promise.reject(new Error('network dropped'));
    expect((await a.service.sync()).error).not.toBeNull();
    await a.service.sync();
    await b.service.sync();
    expect(a.state(aGame ?? 0)?.playCount).toBe(3);
    expect(b.state(bGame ?? 0)?.playCount).toBe(3);
  });

  it("a PC whose clock runs ahead doesn't keep winning with its own changes", async () => {
    const server = fakeSyncServer();
    const a = await pc(server, { now: () => new Date('2026-11-14T12:00:00.000Z') });
    const b = await pc(server, { now: () => new Date('2026-11-13T12:00:30.000Z') });
    const [aGame] = seedGames(a.db, 'snes', ['Mario']);
    const [bGame] = seedGames(b.db, 'snes', ['Mario']);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    a.db.$client
      .prepare('insert into game_user_state (game_id, favorite) values (?, 1)')
      .run(aGame ?? 0);
    await a.service.sync();
    await b.service.sync();
    expect(b.state(bGame ?? 0)?.favorite).toBe(1);
    b.db.$client.prepare('update game_user_state set favorite = 0').run();
    await b.service.sync();
    await a.service.sync();
    await b.service.sync();
    expect(b.state(bGame ?? 0)?.favorite).toBe(0);
    expect(a.state(aGame ?? 0)?.favorite).toBe(0);
  });

  it("a value this PC can't apply stays in the account (a newer version's collection)", async () => {
    const server = fakeSyncServer();
    const b = await pc(server);
    seedGames(b.db, 'snes', ['Mario']);
    await b.service.setEnabled(true);
    const doc = server.docs.get('collections');
    const data = (doc?.data ?? { v: 1, entries: {} }) as { v: 1; entries: Record<string, unknown> };
    const key = 'c:11111111-1111-1111-1111-111111111111';
    data.entries[key] = {
      value: { name: 'From newer PC', sort: 'rating' },
      updatedAt: '2026-11-13T12:00:00.500Z',
    };
    server.docs.set('collections', {
      revision: (doc?.revision ?? 0) + 1,
      data,
      updatedAt: '2026-11-13T12:00:00.500Z',
    });
    await b.service.sync();
    await b.service.sync();
    server.calls.length = 0;
    await b.service.sync();
    expect(entriesOf(server, 'collections')[key]).toMatchObject({ value: { sort: 'rating' } });
    expect(entriesOf(server, 'collections')[key]?.deleted).toBeUndefined();
    expect(server.calls.filter((call) => call.startsWith('PUT'))).toEqual([]);
  });

  it('the same collection name made on two PCs syncing at once becomes one, keeping both games', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const aIds = seedGames(a.db, 'snes', ['Mario', 'Zelda']);
    const bIds = seedGames(b.db, 'snes', ['Mario', 'Zelda']);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    const aRepo = new CollectionRepository(a.db, () => new Date());
    aRepo.addGames(aRepo.create('Arcade').id, [aIds[0] ?? 0]);
    const bRepo = new CollectionRepository(b.db, () => new Date());
    bRepo.addGames(bRepo.create('Arcade').id, [bIds[1] ?? 0]);
    server.beforePut = async () => {
      await a.service.sync();
    };
    await b.service.sync();
    for (let i = 0; i < 3; i += 1) {
      await a.service.sync();
      await b.service.sync();
    }
    expect(a.collection('Arcade')?.titles.sort()).toEqual(['Mario', 'Zelda']);
    expect(b.collection('Arcade')?.titles.sort()).toEqual(['Mario', 'Zelda']);
  });

  it('two collections swapping names on one PC swap on the other too', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const aRepo = new CollectionRepository(a.db, () => new Date());
    const x = aRepo.create('Retro');
    const y = aRepo.create('Arcade');
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    aRepo.update(y.id, { name: 'Tmp' });
    aRepo.update(x.id, { name: 'Arcade' });
    aRepo.update(y.id, { name: 'Retro' });
    await a.service.sync();
    await b.service.sync();
    await a.service.sync();
    const names = (p: typeof a) =>
      p.db.$client.prepare('select name from collections order by sync_id').pluck().all();
    expect(names(b)).toEqual(names(a));
  });

  it('Delete synced data while a sync runs waits for it and nothing comes back', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    seedGames(a.db, 'snes', [{ title: 'Mario', favorite: true }]);
    a.menus.create('Home', []);
    await a.service.setEnabled(true);
    a.db.$client.prepare('update game_user_state set hidden = 1').run();
    // Delete synced data is pressed between two documents of a running sync.
    let deleted: Promise<unknown> = Promise.resolve();
    server.afterPut = () => {
      deleted = a.service.deleteRemote();
    };
    await a.service.sync();
    await deleted;
    for (const kind of ['settings', 'collections', 'userState', 'menus']) {
      expect(server.docs.get(kind)?.data ?? null, kind).toBeNull();
    }
    expect(a.service.state().enabled).toBe(false);
  });

  it('one document that is too large neither applies nor stops the others', async () => {
    const server = fakeSyncServer();
    const a = await pc(server, {
      maxBytes: (kind) => (kind === 'userState' ? 600 : 5 * 1024 * 1024),
    });
    const b = await pc(server);
    const games = Array.from({ length: 20 }, (_, i) => ({
      title: `Game ${String(i)}`,
      favorite: true,
    }));
    seedGames(a.db, 'snes', games);
    seedGames(
      b.db,
      'snes',
      games.map((game) => game.title),
    );
    a.menus.create('Home', []);
    await b.service.setEnabled(true);
    const state = await a.service.setEnabled(true);
    expect(state.error).toBe('tooLarge');
    expect(server.docs.get('menus')?.data).not.toBeNull();
    expect(server.docs.get('userState')?.data ?? null).toBeNull();
  });
});
