import {
  AppErrorException,
  ERROR_CODES,
  type InstallStatus,
  type InstallStatusRequest,
} from '@nextlevel/shared';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogInstallRepository } from '../library/CatalogInstallRepository.ts';
import { CatalogSync } from './CatalogSync.ts';
import { installWorld } from './installWorld.ts';
import { ItemLocks } from './itemLocks.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close();
});

type Answer = InstallStatus['items'][number];

async function setup(answer: (request: InstallStatusRequest) => Promise<Answer[]> | Answer[]) {
  const w = await installWorld(closers);
  const locks = new ItemLocks();
  const removed: string[][] = [];
  const requests: InstallStatusRequest[] = [];
  const state = { online: true };
  const sync = new CatalogSync({
    installs: new CatalogInstallRepository(w.db),
    client: {
      status: async (request) => {
        requests.push(request);
        return { items: await answer(request) };
      },
    },
    installer: w.installer,
    locks,
    canSync: () => state.online,
    emit: (_event, payload) => removed.push((payload as { titles: string[] }).titles),
    log: { warn: () => undefined },
  });
  const install = async (id: string, slug: string) => {
    const item = w.item({ id, slug, title: `Game ${id}` });
    return (await w.installer.install(item, await w.download(item, {}))).gameId;
  };
  return { ...w, sync, locks, removed, requests, state, install };
}

const gone = (id: string, onLapse: 'keep' | 'remove' | null): Answer => ({
  id,
  state: 'gone',
  version: null,
  onLapse,
});

describe('the lapse rule (FR-CAT-7, D43)', () => {
  it('D43: gone + remove uninstalls without asking and emits catalog.removed with the titles', async () => {
    const t = await setup(() => [
      gone('i1', 'remove'),
      { id: 'i2', state: 'current', version: 1, onLapse: 'keep' },
    ]);
    const first = await t.install('i1', 'one');
    await t.install('i2', 'two');
    // A favorite would need a confirmation from the player; the lapse rule doesn't ask.
    t.db.$client
      .prepare('insert into game_user_state (game_id, favorite) values (?, 1)')
      .run(first);
    await t.sync.sync();
    expect(t.requests[0]?.items).toEqual([
      { id: 'i1', version: 1 },
      { id: 'i2', version: 1 },
    ]);
    expect(t.removed).toEqual([['Game i1']]);
    expect(t.rows('select catalog_item_id as id from catalog_installs')).toEqual([{ id: 'i2' }]);
    expect(existsSync(join(t.managed.path, t.nesFolder, 'one'))).toBe(false);
  });

  it('gone + keep marks the install gone and the game still plays', async () => {
    const t = await setup(() => [gone('i1', 'keep')]);
    const gameId = await t.install('i1', 'one');
    await t.sync.sync();
    expect(t.row('select state, on_lapse as onLapse from catalog_installs')).toEqual({
      state: 'gone',
      onLapse: 'keep',
    });
    expect(t.row('select id from games')).toEqual({ id: gameId });
    expect(existsSync(join(t.managed.path, t.nesFolder, 'one', 'Star Hopper.nes'))).toBe(true);
    expect(t.removed).toEqual([]);
  });

  it('update marks update; current records the item rule', async () => {
    const t = await setup(() => [
      { id: 'i1', state: 'update', version: 2, onLapse: 'remove' },
      { id: 'i2', state: 'current', version: 1, onLapse: 'remove' },
    ]);
    await t.install('i1', 'one');
    await t.install('i2', 'two');
    await t.sync.sync();
    expect(
      t.rows(
        'select catalog_item_id as id, state, on_lapse as onLapse from catalog_installs order by 1',
      ),
    ).toEqual([
      { id: 'i1', state: 'update', onLapse: 'remove' },
      { id: 'i2', state: 'current', onLapse: 'remove' },
    ]);
  });

  it('offline or signed out removes nothing', async () => {
    let calls = 0;
    const t = await setup(() => {
      calls += 1;
      throw new AppErrorException({
        code: 'API_UNREACHABLE',
        message: ERROR_CODES.API_UNREACHABLE,
      });
    });
    await t.install('i1', 'one');
    t.state.online = false;
    await t.sync.sync();
    expect(calls).toBe(0);
    t.state.online = true;
    await t.sync.sync();
    expect(calls).toBe(1);
    expect(t.rows('select catalog_item_id as id, state from catalog_installs')).toEqual([
      { id: 'i1', state: 'current' },
    ]);
  });

  it('an uninstall that fails (a running game holds its file) does not stop the others', async () => {
    const t = await setup(() => [
      gone('i1', 'remove'),
      gone('i2', 'remove'),
      { id: 'i3', state: 'update', version: 2, onLapse: 'keep' },
    ]);
    await t.install('i1', 'one');
    await t.install('i2', 'two');
    await t.install('i3', 'three');
    const real = t.installer.uninstall.bind(t.installer);
    t.installer.uninstall = (itemId, confirm) =>
      itemId === 'i1' ? Promise.reject(new Error('EBUSY')) : real(itemId, confirm);
    await t.sync.sync();
    expect(t.removed).toEqual([['Game i2']]);
    expect(t.rows('select catalog_item_id as id, state from catalog_installs order by 1')).toEqual([
      { id: 'i1', state: 'current' },
      { id: 'i3', state: 'update' },
    ]);
  });

  it('nothing installed asks nothing', async () => {
    const t = await setup(() => []);
    await t.sync.sync();
    expect(t.requests).toEqual([]);
  });

  it('a sync during an install of the same item waits', async () => {
    const t = await setup(() => [gone('i1', 'remove')]);
    await t.install('i1', 'one');
    let release: () => void = () => undefined;
    const busy = t.locks.run(
      'i1',
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const syncing = t.sync.sync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(t.rows('select catalog_item_id from catalog_installs')).toHaveLength(1);
    release();
    await busy;
    await syncing;
    expect(t.rows('select catalog_item_id from catalog_installs')).toHaveLength(0);
  });
});
