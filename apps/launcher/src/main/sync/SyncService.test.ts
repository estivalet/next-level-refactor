import { afterEach, describe, expect, it } from 'vitest';
import { CollectionRepository } from '../library/CollectionRepository.ts';
import { LaunchRepository } from '../library/LaunchRepository.ts';
import { seedGames } from '../library/testing.ts';
import { fakeSyncServer, syncPc } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function pc(server: ReturnType<typeof fakeSyncServer>) {
  const made = await syncPc(server);
  cleanups.push(made.cleanup);
  return made;
}

describe('SyncService (FR-SET-5, D55)', () => {
  it('disabled or signed out → no calls', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    await a.service.sync();
    expect(server.calls).toEqual([]);
    await a.service.setEnabled(true);
    expect(server.calls.length).toBeGreaterThan(0);
    server.calls.length = 0;
    a.signOut();
    await a.service.sync();
    a.service.notify();
    expect(server.calls).toEqual([]);
  });

  it('turning sync on creates this PC’s device key once and syncs at once', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    expect(a.settings().sync.deviceKey).toBeNull();
    const state = await a.service.setEnabled(true);
    const key = a.settings().sync.deviceKey;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(state).toMatchObject({ enabled: true, error: null, syncing: false });
    expect(state.lastSync).not.toBeNull();
    await a.service.setEnabled(false);
    await a.service.setEnabled(true);
    expect(a.settings().sync.deviceKey).toBe(key);
  });

  it('settings follow the account; the first sync of a new PC takes the account’s copy', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    await a.service.setEnabled(true);
    a.setSettings({ ...a.settings(), general: { ...a.settings().general, language: 'pt-BR' } });
    await a.service.sync();
    await b.service.setEnabled(true);
    expect(b.settings().general.language).toBe('pt-BR');
  });

  it('plays add up across devices; this PC’s counter only changes here', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const [aGame] = seedGames(a.db, 'snes', [
      { title: 'Mario', relPath: 'Mario.zip', playCount: 2 },
    ]);
    const [bGame] = seedGames(b.db, 'snes', [
      { title: 'Mario', relPath: 'mario.zip', playCount: 3 },
    ]);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    await a.service.sync();
    expect(a.state(aGame ?? 0)?.playCount).toBe(5);
    expect(b.state(bGame ?? 0)?.playCount).toBe(5);
    new LaunchRepository(a.db).recordPlay(aGame ?? 0, 60, new Date('2026-11-13T13:00:00.000Z'));
    await a.service.sync();
    await b.service.sync();
    await a.service.sync();
    expect(a.state(aGame ?? 0)).toMatchObject({ playCount: 6, playSeconds: 60 });
    expect(b.state(bGame ?? 0)).toMatchObject({
      playCount: 6,
      playSeconds: 60,
      lastPlayedAt: '2026-11-13T13:00:00.000Z',
    });
    const entries = (
      server.docs.get('userState')?.data as { entries: Record<string, { value: unknown }> }
    ).entries;
    expect(entries[`p:${b.settings().sync.deviceKey ?? ''}|snes/mario.zip`]?.value).toMatchObject({
      count: 3,
    });
    expect(entries[`p:${a.settings().sync.deviceKey ?? ''}|snes/mario.zip`]?.value).toMatchObject({
      count: 3,
      seconds: 60,
    });
  });

  it('userState for a game not in the library is kept and applied after a scan adds it', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    seedGames(a.db, 'snes', [{ title: 'Zelda', favorite: true, userRating: 4 }]);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    await b.service.sync();
    const entries = (server.docs.get('userState')?.data as { entries: Record<string, unknown> })
      .entries;
    expect(entries['g:snes/zelda.zip']).toMatchObject({ value: { favorite: true } });
    const [found] = seedGames(b.db, 'snes', ['Zelda']);
    await b.service.sync();
    expect(b.state(found ?? 0)).toMatchObject({ favorite: 1, userRating: 4 });
  });

  it('collections: members by game key; a rename on PC A and an add on PC B both survive', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const aIds = seedGames(a.db, 'snes', ['Mario', 'Zelda', 'Metroid']);
    const bIds = seedGames(b.db, 'snes', ['Mario', 'Zelda', 'Metroid']);
    const aRepo = new CollectionRepository(a.db, () => new Date());
    const made = aRepo.create('RPGs');
    aRepo.addGames(made.id, [aIds[0] ?? 0, aIds[1] ?? 0]);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    expect(b.collection('RPGs')?.titles).toEqual(['Mario', 'Zelda']);
    aRepo.update(made.id, { name: 'Best RPGs' });
    const bCollection = b.collection('RPGs');
    new CollectionRepository(b.db, () => new Date()).addGames(bCollection?.id ?? 0, [bIds[2] ?? 0]);
    await a.service.sync();
    await b.service.sync();
    await a.service.sync();
    expect(a.collection('Best RPGs')?.titles).toEqual(['Mario', 'Zelda', 'Metroid']);
    expect(b.collection('Best RPGs')?.titles).toEqual(['Mario', 'Zelda', 'Metroid']);
  });

  it('a collection made on both PCs with the same name becomes one', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const [aMario] = seedGames(a.db, 'snes', ['Mario']);
    const [, bZelda] = seedGames(b.db, 'snes', ['Mario', 'Zelda']);
    new CollectionRepository(a.db, () => new Date()).addGames(
      new CollectionRepository(a.db, () => new Date()).create('Party').id,
      [aMario ?? 0],
    );
    const bRepo = new CollectionRepository(b.db, () => new Date());
    bRepo.addGames(bRepo.create('party').id, [bZelda ?? 0]);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    await a.service.sync();
    expect(a.collection('Party')?.titles).toEqual(['Mario']);
    expect(b.collection('Party')?.titles.sort()).toEqual(['Mario', 'Zelda']);
    const count = b.db.$client.prepare('select count(*) from collections').pluck().get();
    expect(count).toBe(1);
  });

  it('menus: collection nodes are translated to sync ids and back', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const [aMario] = seedGames(a.db, 'snes', ['Mario']);
    seedGames(b.db, 'snes', ['Mario']);
    const repo = new CollectionRepository(a.db, () => new Date());
    const party = repo.create('Party');
    repo.addGames(party.id, [aMario ?? 0]);
    const node = (type: 'collection' | 'system', refId: string, name: string) => ({
      id: crypto.randomUUID(),
      type,
      refId,
      name,
      displayName: null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [],
    });
    a.menus.create('Home', [
      node('system', 'snes', 'snes'),
      node('collection', String(party.id), 'Party'),
    ]);
    // B already has a collection with a lower id, so the integer ids differ between the PCs.
    new CollectionRepository(b.db, () => new Date()).create('Other');
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    const menu = b.menus.active();
    expect(menu?.title).toBe('Home');
    const bParty = b.collection('Party');
    expect(menu?.nodes.map((n) => n.refId)).toEqual(['snes', String(bParty?.id)]);
    expect(String(bParty?.id)).not.toBe(String(party.id));
    // Nothing changed since: a second round writes nothing.
    server.calls.length = 0;
    await a.service.sync();
    await b.service.sync();
    expect(server.calls.filter((call) => call.startsWith('PUT'))).toEqual([]);
  });

  it('409 → pull, merge, retry once; offline → error kept, next timer retries', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    const [, , aMetroid] = seedGames(a.db, 'snes', [
      { title: 'Mario', favorite: true },
      'Zelda',
      'Metroid',
    ]);
    const [, bZelda, bMetroid] = seedGames(b.db, 'snes', ['Mario', 'Zelda', 'Metroid']);
    await a.service.start();
    await b.service.start();
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    // A writes a change to the same document right before B's write lands.
    a.db.$client
      .prepare('insert into game_user_state (game_id, completed) values (?, 1)')
      .run(aMetroid ?? 0);
    b.db.$client.prepare('update game_user_state set hidden = 1').run();
    b.db.$client
      .prepare('insert into game_user_state (game_id, hidden) values (?, 1) on conflict do nothing')
      .run(bZelda ?? 0);
    server.beforePut = async () => {
      await a.service.sync();
    };
    server.calls.length = 0;
    const state = await b.service.sync();
    expect(state.error).toBeNull();
    // B's write (refused: 409), A's write that got in first, B's retry on the merged copy.
    expect(server.calls.filter((call) => call === 'PUT /v1/sync/userState')).toHaveLength(3);
    expect(b.state(bZelda ?? 0)).toMatchObject({ hidden: 1 });
    expect(b.state(bMetroid ?? 0)).toMatchObject({ completed: 1 });
    await a.service.sync();
    expect(
      a.db.$client.prepare('select count(*) from game_user_state where hidden = 1').pluck().get(),
    ).toBe(2);

    server.offline = true;
    a.db.$client.prepare('update game_user_state set favorite = 0').run();
    expect((await a.service.sync()).error).toBe('offline');
    expect(a.service.state().error).toBe('offline');
    server.offline = false;
    for (const tick of a.timers) tick();
    await a.service.sync();
    expect(a.service.state().error).toBeNull();
    await b.service.sync();
    expect(
      b.db.$client.prepare('select count(*) from game_user_state where favorite = 1').pluck().get(),
    ).toBe(0);
  });

  it('Delete synced data clears the account and turns sync off; another PC turns off instead of uploading it again', async () => {
    const server = fakeSyncServer();
    const a = await pc(server);
    const b = await pc(server);
    seedGames(a.db, 'snes', [{ title: 'Mario', favorite: true }]);
    await a.service.setEnabled(true);
    await b.service.setEnabled(true);
    const state = await a.service.deleteRemote();
    expect(state.enabled).toBe(false);
    expect(server.docs.get('userState')?.data).toBeNull();
    const after = await b.service.sync();
    expect(after).toMatchObject({ enabled: false, error: 'deletedElsewhere' });
    expect(server.docs.get('userState')?.data).toBeNull();
    // Turned on again later, it starts over without an error.
    expect((await b.service.setEnabled(true)).error).toBeNull();
  });

  it('a sync.json that cannot be written never fails the sync', async () => {
    const server = fakeSyncServer();
    const a = await syncPc(server, {
      write: () => Promise.reject(Object.assign(new Error('locked'), { code: 'EPERM' })),
    });
    cleanups.push(a.cleanup);
    const state = await a.service.setEnabled(true);
    expect(state).toMatchObject({ enabled: true, error: null });
    expect(state.lastSync).not.toBeNull();
  });
});
