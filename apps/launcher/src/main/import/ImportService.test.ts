import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
    expect(summary.games).toEqual({ matched: 0, inserted: 12, missing: 4 });
    expect(summary).toMatchObject({ collections: 2, menus: 2 });
    expect(libraryCounts(h)).toEqual({
      games: 13,
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

  it('D60: a game completed here stays completed when importing again', async () => {
    const h = await setup();
    await h.run();
    const pixel = h.gameId('atari-2600', 'Pixel Quest.a26') ?? 0;
    h.games.setFlags([pixel], { completed: true });
    await h.run();
    expect(
      h.client
        .prepare('select completed from game_user_state where game_id = ?')
        .pluck()
        .get(pixel),
    ).toBe(1);
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

  it('the library follows the gamelists: files no list names are not added', async () => {
    const h = await setup();
    await h.run();
    expect(h.gameId('atari-2600', 'Extra Find.a26')).toBeUndefined();
    expect(h.gameId('atari-2600', 'Pixel Quest.a26')).toBeDefined();
  });

  it('a game only a collection names stays in the collection, out of its system', async () => {
    const h = await setup();
    await h.run();
    const gem = h.gameId('atari-2600', 'Hidden Gem.a26');
    const pixel = h.gameId('atari-2600', 'Pixel Quest.a26');
    expect(h.count(`select collection_only from games where id = ${String(gem)}`)).toBe(1);
    expect(h.count(`select collection_only from games where id = ${String(pixel)}`)).toBe(0);
    const system = h.games.list({
      scope: { kind: 'system', systemId: 'atari-2600' },
      tab: 'all',
      offset: 0,
      limit: 100,
    });
    expect(system.games.map((r) => r.id)).not.toContain(gem);
    expect(system.games.map((r) => r.id)).toContain(pixel);
    const party = h.collections.list().find((c) => c.name === 'Party Picks');
    const members = h.games.list({
      scope: { kind: 'collection', collectionId: party?.id ?? 0 },
      tab: 'all',
      offset: 0,
      limit: 100,
    });
    expect(members.games.map((r) => r.id)).toContain(gem);
  });

  it('a gamelist no menu opens is reported and not imported', async () => {
    const h = await setup();
    await writeFile(
      join(h.copy.data, 'gamelists', 'Atari 2600 copy.json'),
      JSON.stringify({ games: [{ filename: './Old Thing.a26', system: 'Atari 2600' }] }),
    );
    const report = await h.service.dryRun(h.copy.data, null);
    expect(report.unmapped).toContainEqual({
      area: 'collection',
      key: 'Atari 2600 copy',
      reason: 'notInMenu',
      count: 1,
    });
    expect(report.counts.collections).toBe(2);
    await h.service.apply(h.copy.data, null, report.token);
    expect(h.collections.list().map((c) => c.name)).not.toContain('Atari 2600 copy');
    expect(h.gameId('atari-2600', 'Old Thing.a26')).toBeUndefined();
  });

  it('IA F6: a scan cancelled during the import stops it before the menus', async () => {
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
    // Games and collections are written (missing until a scan finds them); menus are not.
    expect(h.count('select count(*) from games where missing = 0')).toBe(0);
    expect(h.count('select count(*) from collections')).toBe(2);
    expect(h.count('select count(*) from menus')).toBe(0);
    vi.restoreAllMocks();
    await h.scan.start(['atari-2600']);
    await h.scan.whenIdle();
    expect(h.count(`select missing from games where rel_path = 'Pixel Quest.a26'`)).toBe(0);
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

describe('ImportService per-game emulators (FR-EMU-4)', () => {
  it('a game run with another emulator in NextLevelOS gets that profile as its launch option', async () => {
    const h = await setup();
    const launchersPath = join(h.copy.data, 'launchers.json');
    const launchers = JSON.parse(await readFile(launchersPath, 'utf8')) as Record<
      string,
      { command: string }
    >;
    const gx = launchers['Amstrad GX4000'];
    if (gx) gx.command += ' --emulator="%emulator%"';
    await writeFile(launchersPath, JSON.stringify(launchers));
    await writeFile(
      join(h.copy.data, 'gamelists', 'Amstrad Gx4000.json'),
      JSON.stringify({ games: [{ filename: './Cart Racer.cpr', emulator: 'mame' }] }),
    );
    const emulators = join(h.copy.root, 'emulators');
    for (const [folder, exe] of [
      ['MAME', 'mame.exe'],
      ['RetroArch', 'retroarch.exe'],
    ] as const) {
      await mkdir(join(emulators, folder), { recursive: true });
      await writeFile(join(emulators, folder, exe), 'invented');
    }
    await h.run(emulators);
    const profileOf = () =>
      h.client
        .prepare(
          `select o.profile_id from game_launch_override o join games g on g.id = o.game_id
           where g.rel_path = 'Cart Racer.cpr'`,
        )
        .pluck()
        .get() as string | undefined;
    const load = h.settings.get();
    const settings = load.kind === 'ok' ? load.snapshot.settings : undefined;
    const mame = settings?.profiles.find((p) => p.presetProfileId === 'mame:amstrad-gx4000');
    expect(mame?.systems).toEqual(['amstrad-gx4000']);
    expect(profileOf()).toBe(mame?.id);
    // The system keeps its default (RetroArch); importing again changes nothing.
    expect(settings?.systems['amstrad-gx4000']?.defaultProfileId).not.toBe(mame?.id);
    const profiles = settings?.profiles.length;
    await h.run(emulators);
    const again = h.settings.get();
    expect(again.kind === 'ok' ? again.snapshot.settings.profiles.length : 0).toBe(profiles);
    expect(profileOf()).toBe(mame?.id);
  });
});
