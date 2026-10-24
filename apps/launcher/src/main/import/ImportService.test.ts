import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importHarness, type ImportHarness } from './harness.ts';

const harnesses: ImportHarness[] = [];
async function setup() {
  const made = await importHarness();
  harnesses.push(made);
  return made;
}
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((h) => h.cleanup()));
});

function libraryCounts(h: ImportHarness) {
  return {
    games: h.count('select count(*) from games'),
    missing: h.count('select count(*) from games where missing = 1'),
    collections: h.count('select count(*) from collections'),
    members: h.count('select count(*) from collection_games'),
    menus: h.count('select count(*) from menus'),
    nodes: h.count('select count(*) from menu_nodes'),
    favorites: h.count('select count(*) from game_user_state where favorite = 1'),
    filters: h.count('select count(*) from game_filters'),
    overrides: h.count('select count(*) from game_launch_override'),
    arcade: h.count('select count(*) from arcade_info'),
  };
}

const userState = (h: ImportHarness, id: number | undefined) =>
  h.client
    .prepare(
      'select favorite, hidden, play_count as playCount, last_played_at as lastPlayedAt from game_user_state where game_id = ?',
    )
    .get(id) as
    | { favorite: number; hidden: number; playCount: number; lastPlayedAt: string | null }
    | undefined;

describe('ImportService.apply', () => {
  it('US-B3, C5: the fixture imports with the expected games, flags, collections and menus', async () => {
    const h = await setup();
    const summary = await h.run();
    // System gamelist entries only: Hidden Gem (a collection-only member) is a missing row too.
    expect(summary.games).toEqual({ matched: 8, inserted: 4, missing: 4 });
    expect(summary).toMatchObject({ collections: 2, menus: 2 });
    expect(libraryCounts(h)).toEqual({
      games: 14,
      missing: 5,
      collections: 2,
      members: 6,
      menus: 2,
      nodes: 18,
      favorites: 3,
      filters: 5,
      overrides: 1,
      arcade: 2,
    });
    const pixel = h.gameId('atari-2600', 'Pixel Quest.a26');
    expect(userState(h, pixel)).toEqual({
      favorite: 1,
      hidden: 0,
      playCount: 20,
      lastPlayedAt: new Date(2026, 6, 22, 10, 5, 30).toISOString(),
    });
    expect(userState(h, h.gameId('atari-2600', 'Moon Hopper.a26'))).toMatchObject({ hidden: 1 });
    const party = h.collections.list().find((c) => c.name === 'Party Picks');
    const titles = h.client
      .prepare(
        `select m.title from collection_games cg join game_metadata m on m.game_id = cg.game_id
         where cg.collection_id = ? order by cg.position`,
      )
      .pluck()
      .all(party?.id);
    expect(titles).toEqual(['Blastoid', 'Pixel Quest', 'Hidden Gem', 'Fuzzy Kart']);
    const active = h.menus.active();
    expect(active).toMatchObject({ title: 'Main', source: 'nextlevelos:menu.json' });
    expect(active?.nodes.map((n) => n.name)).toEqual([
      'Consoles',
      'Computers',
      'Arcade',
      'Flash Games',
      'Collections',
    ]);
    const loaded = h.settings.get();
    expect(loaded.kind === 'ok' && loaded.snapshot.settings.storage.locations).toHaveLength(3);
    expect(h.events.map((e) => e.event)).toEqual(
      expect.arrayContaining(['library.changed', 'menus.changed']),
    );
  });

  it('US-B3, C5: importing again changes no counts and duplicates nothing', async () => {
    const h = await setup();
    await h.run();
    const first = libraryCounts(h);
    const again = await h.run();
    expect(libraryCounts(h)).toEqual(first);
    expect(again.games).toEqual({ matched: 12, inserted: 0, missing: 4 });
    expect(again.settingsBackupId).toBeNull();
  });

  it('D12: a field edited here survives, NextLevelOS flags win, plays take the max', async () => {
    const h = await setup();
    await h.run();
    const pixel = h.gameId('atari-2600', 'Pixel Quest.a26') ?? 0;
    const blastoid = h.gameId('arcade', 'blastoid.zip') ?? 0;
    const cart = h.gameId('amstrad-gx4000', 'Cart Racer.cpr') ?? 0;
    h.games.updateMetadata(pixel, { title: 'My Pixel Quest' }, new Date());
    h.games.setFlags([pixel], { favorite: false });
    h.client.prepare('update game_user_state set play_count = 3 where game_id = ?').run(blastoid);
    h.client.prepare('update game_user_state set play_count = 7 where game_id = ?').run(cart);
    await h.run();
    const meta = h.client
      .prepare('select title, year from game_metadata where game_id = ?')
      .get(pixel) as { title: string; year: number };
    expect(meta).toEqual({ title: 'My Pixel Quest', year: 1983 });
    expect(userState(h, pixel)?.favorite).toBe(1);
    expect(userState(h, blastoid)?.playCount).toBe(5);
    expect(userState(h, cart)?.playCount).toBe(7);
  });

  it('D12: a collection made here keeps its name; the imported one gets a suffix', async () => {
    const h = await setup();
    const mine = h.collections.create('Favorites Mix');
    const summary = await h.run();
    expect(summary.collections).toBe(2);
    const names = h.collections.list().map((c) => [c.name, c.games]);
    expect(names).toEqual(
      expect.arrayContaining([
        ['Favorites Mix', 0],
        ['Favorites Mix (NextLevelOS)', 2],
      ]),
    );
    expect(h.collections.list().find((c) => c.id === mine.id)?.games).toBe(0);
  });

  it('D13: an entry without a file is a missing row that a later scan revives', async () => {
    const h = await setup();
    await h.run();
    const kart = h.gameId('nintendo-64', 'Fuzzy Kart.z64');
    expect(h.count(`select missing from games where id = ${String(kart)}`)).toBe(1);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(h.copy.root, 'roms', 'a', 'Nintendo 64'), { recursive: true });
    await writeFile(join(h.copy.root, 'roms', 'a', 'Nintendo 64', 'Fuzzy Kart.z64'), 'invented');
    await h.scan.start(['nintendo-64']);
    await h.scan.whenIdle();
    expect(h.gameId('nintendo-64', 'Fuzzy Kart.z64')).toBe(kart);
    expect(h.count(`select missing from games where id = ${String(kart)}`)).toBe(0);
    expect(userState(h, kart)?.favorite).toBe(1);
  });

  it('IA F6: a folder changed after the dry run is refused before anything is written', async () => {
    const h = await setup();
    const report = await h.service.dryRun(h.copy.data, null);
    await writeFile(join(h.copy.data, 'gamelists', 'Flash Games.json'), '{ "games": [] }');
    await expect(h.service.apply(h.copy.data, null, report.token)).rejects.toMatchObject({
      error: { code: 'CONFLICT' },
    });
    expect(h.count('select count(*) from games')).toBe(0);
    const loaded = h.settings.get();
    expect(loaded.kind === 'ok' && loaded.snapshot.revision).toBe(0);
  });

  it('IA F6: a scan cancelled during the import stops it before games are matched', async () => {
    const h = await setup();
    const report = await h.service.dryRun(h.copy.data, null);
    const start = h.scan.start.bind(h.scan);
    vi.spyOn(h.scan, 'start').mockImplementation(async (ids) => {
      const status = await start(ids);
      h.scan.cancel();
      return status;
    });
    await expect(h.service.apply(h.copy.data, null, report.token)).rejects.toMatchObject({
      error: { code: 'INTERNAL', details: { reason: 'scanIncomplete', outcome: 'cancelled' } },
    });
    // No games stage: nothing was turned into a missing row, no collection or menu was written.
    expect(h.count('select count(*) from games where missing = 1')).toBe(0);
    expect(h.count('select count(*) from collections')).toBe(0);
    expect(h.count('select count(*) from menus')).toBe(0);
  });

  it('IA F6: a scan already running refuses the import with BUSY', async () => {
    const h = await setup();
    const report = await h.service.dryRun(h.copy.data, null);
    vi.spyOn(h.scan, 'status').mockReturnValue({ running: true, progress: null, last: null });
    await expect(h.service.apply(h.copy.data, null, report.token)).rejects.toMatchObject({
      error: { code: 'BUSY' },
    });
    expect(h.count('select count(*) from games')).toBe(0);
  });
});
