import type { CustomSystem, SystemDefinition, SystemInfo } from '@nextlevel/shared';
import { systemInfoSeed } from '@nextlevel/system-catalog';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SystemInfoRepository } from '../library/SystemInfoRepository.ts';
import { appErrorOfAsync, seedGames, tempLibrary } from '../library/testing.ts';
import { createSystemInfoHandlers } from './systemInfoHandlers.ts';

const definition = (id: string, name: string): SystemDefinition => ({
  id,
  name,
  kind: 'console',
  extensions: ['zip'],
  defaultFolderName: id,
  scraper: {},
  presetProfiles: [],
  aliases: [],
});

const custom: CustomSystem = {
  id: 'custom-box',
  name: 'box',
  manufacturer: 'Acme',
  releaseYear: 1990,
  kind: 'console',
  folderName: 'box',
  extensions: ['bin'],
};
const systems = [
  definition('plain', 'Plain'),
  definition('aamber-pegasus', 'Aamber Pegasus'),
  definition('apricot-pc', 'Apricot PC'),
  definition('custom-box', 'box'),
];
const entryOf = (systemId: string, extra: Partial<SystemInfo> = {}): SystemInfo => ({
  systemId,
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
  ...extra,
});

let lib: Awaited<ReturnType<typeof tempLibrary>>;
let repo: SystemInfoRepository | null;
let events: Array<[string, unknown]>;
const handlers = () =>
  createSystemInfoHandlers({
    systems: () => systems,
    customSystems: () => [custom],
    repo: () => repo,
    emit: (event, payload) => {
      events.push([event, payload]);
    },
  });

beforeEach(async () => {
  lib = await tempLibrary();
  repo = new SystemInfoRepository(lib.db, () => new Date(Date.UTC(2026, 10, 15)));
  events = [];
});
afterEach(() => lib.cleanup());

describe('systems.info handlers', () => {
  it('FR-MUS-1: get on a system with no seed returns { entry: { systemId }, edited: false }', async () => {
    expect(await handlers()['systems.info.get']({ systemId: 'plain' })).toEqual({
      entry: entryOf('plain'),
      edited: false,
    });
  });

  it("FR-MUS-1: a custom system's base entry uses its settings fields", async () => {
    const { entry } = await handlers()['systems.info.get']({ systemId: 'custom-box' });
    expect(entry).toMatchObject({ manufacturer: 'Acme', releaseYear: 1990 });
  });

  it('FR-MUS-2: an edit replaces the seed and is flagged edited; reset restores the seed and emits systems.infoChanged', async () => {
    const h = handlers();
    const seed = systemInfoSeed('aamber-pegasus');
    expect(await h['systems.info.get']({ systemId: 'aamber-pegasus' })).toEqual({
      entry: seed,
      edited: false,
    });
    const mine = entryOf('aamber-pegasus', { fullName: 'Mine' });
    await h['systems.info.save']({ systemId: 'aamber-pegasus', entry: mine });
    expect(await h['systems.info.get']({ systemId: 'aamber-pegasus' })).toEqual({
      entry: mine,
      edited: true,
    });
    const listed = await h['systems.info.list']();
    expect(listed.find((row) => row.systemId === 'aamber-pegasus')).toMatchObject({
      edited: true,
      manufacturer: null,
    });
    expect(await h['systems.info.reset']({ systemId: 'aamber-pegasus' })).toEqual(seed);
    expect((await h['systems.info.get']({ systemId: 'aamber-pegasus' })).edited).toBe(false);
    expect(events).toEqual([
      ['systems.infoChanged', { systemId: 'aamber-pegasus' }],
      ['systems.infoChanged', { systemId: 'aamber-pegasus' }],
    ]);
  });

  it('FR-MUS-2: unknown system is NOT_FOUND; mismatched entry.systemId is VALIDATION_FAILED', async () => {
    const h = handlers();
    const code = async (run: () => unknown) =>
      (
        await appErrorOfAsync(async () => {
          await run();
        })
      ).code;
    expect(await code(() => h['systems.info.get']({ systemId: 'nope' }))).toBe('NOT_FOUND');
    expect(await code(() => h['systems.info.reset']({ systemId: 'nope' }))).toBe('NOT_FOUND');
    expect(
      await code(() => h['systems.info.save']({ systemId: 'nope', entry: entryOf('nope') })),
    ).toBe('NOT_FOUND');
    expect(
      await code(() => h['systems.info.save']({ systemId: 'plain', entry: entryOf('other') })),
    ).toBe('VALIDATION_FAILED');
    expect(events).toEqual([]);
  });

  it('FR-MUS-2: list is sorted by name and ignores rows for systems that no longer exist', async () => {
    repo?.save(entryOf('gone', { manufacturer: 'Ghost' }));
    const listed = await handlers()['systems.info.list']();
    expect(listed.map((row) => row.systemId)).toEqual([
      'aamber-pegasus',
      'apricot-pc',
      'custom-box',
      'plain',
    ]);
    expect(listed.every((row) => !row.edited)).toBe(true);
    expect(listed[2]).toMatchObject({ name: 'box', manufacturer: 'Acme', releaseYear: 1990 });
  });

  it('FR-MUS-2: without a library, get serves the seed and save fails LIBRARY_UNAVAILABLE', async () => {
    repo = null;
    const h = handlers();
    expect(await h['systems.info.get']({ systemId: 'aamber-pegasus' })).toEqual({
      entry: systemInfoSeed('aamber-pegasus'),
      edited: false,
    });
    expect(await h['systems.info.list']()).toHaveLength(4);
    const save = await appErrorOfAsync(async () =>
      h['systems.info.save']({ systemId: 'plain', entry: entryOf('plain') }),
    );
    expect(save.code).toBe('LIBRARY_UNAVAILABLE');
    const reset = await appErrorOfAsync(async () => h['systems.info.reset']({ systemId: 'plain' }));
    expect(reset.code).toBe('LIBRARY_UNAVAILABLE');
    expect(events).toEqual([]);
  });

  it('FR-MUS-4: forTheme resolves owned top games; null for an unknown system', async () => {
    const [gameId] = seedGames(lib.db, 'apricot-pc', ['Lotus 1-2-3 (USA)']);
    const h = handlers();
    const themed = await h['systems.info.forTheme']({ systemId: 'apricot-pc' });
    expect(themed?.topGames[0]).toMatchObject({ title: 'Lotus 1-2-3', owned: { gameId } });
    expect(await h['systems.info.forTheme']({ systemId: 'nope' })).toBeNull();
  });

  it('FR-MUS-4: forTheme without a library marks every top game as not owned', async () => {
    repo = null;
    const themed = await handlers()['systems.info.forTheme']({ systemId: 'apricot-pc' });
    expect(themed?.topGames.length).toBeGreaterThan(0);
    expect(themed?.topGames.every((game) => game.owned === null)).toBe(true);
  });
});
