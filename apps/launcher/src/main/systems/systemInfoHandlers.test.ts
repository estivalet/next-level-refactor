import {
  emptyPersonal,
  type CustomSystem,
  type SystemDefinition,
  type SystemInfo,
  type SystemPersonal,
} from '@nextlevel/shared';
import { systemInfoSeed } from '@nextlevel/system-catalog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemInfoRepository } from '../library/SystemInfoRepository.ts';
import { SystemPersonalRepository } from '../library/SystemPersonalRepository.ts';
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
let personalRepo: SystemPersonalRepository | null;
let images: { add: ReturnType<typeof vi.fn>; keepOnly: ReturnType<typeof vi.fn> };
let picked: string[];
let events: Array<[string, unknown]>;
let warn: ReturnType<typeof vi.fn<(context: object, msg: string) => void>>;
const handlers = () =>
  createSystemInfoHandlers({
    systems: () => systems,
    customSystems: () => [custom],
    repo: () => repo,
    personal: () => personalRepo,
    images: images as never,
    pickImages: () => Promise.resolve(picked),
    emit: (event, payload) => {
      events.push([event, payload]);
    },
    log: { warn },
  });

beforeEach(async () => {
  lib = await tempLibrary();
  repo = new SystemInfoRepository(lib.db, () => new Date(Date.UTC(2026, 10, 15)));
  personalRepo = new SystemPersonalRepository(lib.db, () => new Date(Date.UTC(2026, 10, 16)));
  images = {
    add: vi.fn(() => Promise.resolve({ added: [], rejected: [] })),
    keepOnly: vi.fn(() => Promise.resolve()),
  };
  picked = [];
  events = [];
  warn = vi.fn();
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

  it('FR-MUS-2: a corrupt edited row serves the seed, stays edited (Reset shows) and logs a warning', async () => {
    lib.db.$client
      .prepare("insert into system_info (system_id, entry, updated_at) values (?, ?, 'now')")
      .run('aamber-pegasus', '{"systemId":"aamber-pegasus","fullName":"SECRET-TEXT"');
    const h = handlers();
    expect(await h['systems.info.get']({ systemId: 'aamber-pegasus' })).toEqual({
      entry: systemInfoSeed('aamber-pegasus'),
      edited: true,
    });
    const listed = await h['systems.info.list']();
    expect(listed.find((row) => row.systemId === 'aamber-pegasus')?.edited).toBe(true);
    expect(warn).toHaveBeenCalledWith({ systemId: 'aamber-pegasus' }, expect.any(String));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRET-TEXT');
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

  const mine = (systemId: string, extra: Partial<SystemPersonal> = {}): SystemPersonal => ({
    ...emptyPersonal(systemId),
    ...extra,
  });
  const code = async (run: () => unknown) =>
    (
      await appErrorOfAsync(async () => {
        await run();
      })
    ).code;
  const FILE = '00000000-0000-4000-8000-000000000001.png';

  it('FR-MUS-9: list reports hasNotes and changedAt from both tables', async () => {
    const h = handlers();
    await h['systems.personal.save']({
      systemId: 'apricot-pc',
      personal: mine('apricot-pc', { notes: 'hi' }),
    });
    await h['systems.personal.save']({
      systemId: 'plain',
      personal: mine('plain', { gallery: [{ file: FILE }] }),
    });
    const listed = await h['systems.info.list']();
    const row = (id: string) => listed.find((r) => r.systemId === id);
    expect(row('apricot-pc')).toMatchObject({
      hasNotes: true,
      changedAt: '2026-11-16T00:00:00.000Z',
    });
    expect(row('plain')).toMatchObject({ hasNotes: false, changedAt: '2026-11-16T00:00:00.000Z' });
    expect(row('aamber-pegasus')).toMatchObject({ hasNotes: false, changedAt: null });
  });

  it('FR-MUS-9: changedAt is the later of the entry and personal timestamps', async () => {
    repo = new SystemInfoRepository(lib.db, () => new Date(Date.UTC(2026, 10, 17)));
    const h = handlers();
    await h['systems.info.save']({ systemId: 'plain', entry: entryOf('plain') });
    await h['systems.personal.save']({
      systemId: 'plain',
      personal: mine('plain', { notes: 'x' }),
    });
    const listed = await h['systems.info.list']();
    expect(listed.find((r) => r.systemId === 'plain')?.changedAt).toBe('2026-11-17T00:00:00.000Z');
  });

  it('FR-MUS-6: personal.save stores notes, prunes images and emits systems.infoChanged', async () => {
    const h = handlers();
    const personal = mine('plain', { notes: 'Mine', gallery: [{ file: FILE }] });
    expect(await h['systems.personal.save']({ systemId: 'plain', personal })).toEqual(personal);
    expect(await h['systems.personal.get']({ systemId: 'plain' })).toEqual(personal);
    expect(images.keepOnly).toHaveBeenCalledWith('plain', [FILE]);
    expect(events).toEqual([['systems.infoChanged', { systemId: 'plain' }]]);
  });

  it('FR-MUS-6: reset leaves the personal record untouched', async () => {
    const h = handlers();
    const personal = mine('aamber-pegasus', { notes: 'Mine' });
    await h['systems.personal.save']({ systemId: 'aamber-pegasus', personal });
    await h['systems.info.save']({ systemId: 'aamber-pegasus', entry: entryOf('aamber-pegasus') });
    await h['systems.info.reset']({ systemId: 'aamber-pegasus' });
    expect(await h['systems.personal.get']({ systemId: 'aamber-pegasus' })).toEqual(personal);
  });

  it('FR-MUS-6: personal.save with a mismatched systemId fails VALIDATION_FAILED', async () => {
    const h = handlers();
    expect(
      await code(() => h['systems.personal.save']({ systemId: 'plain', personal: mine('other') })),
    ).toBe('VALIDATION_FAILED');
    expect(images.keepOnly).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('FR-MUS-6: personal channels fail NOT_FOUND for an unknown system; without a library get is empty and save fails', async () => {
    const h = handlers();
    expect(await code(() => h['systems.personal.get']({ systemId: 'nope' }))).toBe('NOT_FOUND');
    expect(
      await code(() => h['systems.personal.save']({ systemId: 'nope', personal: mine('nope') })),
    ).toBe('NOT_FOUND');
    expect(await code(() => h['systems.personal.cleanup']({ systemId: 'nope' }))).toBe('NOT_FOUND');
    personalRepo = null;
    expect(await h['systems.personal.get']({ systemId: 'plain' })).toEqual(mine('plain'));
    expect(
      await code(() => h['systems.personal.save']({ systemId: 'plain', personal: mine('plain') })),
    ).toBe('LIBRARY_UNAVAILABLE');
    expect(await h['systems.info.list']()).toHaveLength(4);
  });

  it('FR-MUS-8: addImages returns added/rejected and does not save', async () => {
    picked = ['C:/x/a.png', 'C:/x/b.bmp'];
    const result = {
      added: [{ file: FILE }],
      rejected: [{ name: 'b.bmp', reason: 'type' as const }],
    };
    images.add.mockResolvedValueOnce(result);
    const h = handlers();
    expect(await h['systems.personal.addImages']({ systemId: 'plain' })).toEqual(result);
    expect(images.add).toHaveBeenCalledWith('plain', picked);
    expect(await h['systems.personal.get']({ systemId: 'plain' })).toEqual(mine('plain'));
    expect(events).toEqual([]);
  });

  it('FR-MUS-8: addImages when the dialog is cancelled returns empty lists', async () => {
    picked = [];
    const result = await handlers()['systems.personal.addImages']({ systemId: 'plain' });
    expect(result).toEqual({ added: [], rejected: [] });
    expect(images.add).not.toHaveBeenCalled();
  });

  it('FR-MUS-8: addImages for an unknown system is NOT_FOUND and never opens the picker', async () => {
    picked = ['C:/x/a.png'];
    expect(await code(() => handlers()['systems.personal.addImages']({ systemId: 'nope' }))).toBe(
      'NOT_FOUND',
    );
    expect(images.add).not.toHaveBeenCalled();
  });

  it("FR-MUS-8: cleanup keeps only the stored gallery's files", async () => {
    const h = handlers();
    await h['systems.personal.save']({
      systemId: 'plain',
      personal: mine('plain', { gallery: [{ file: FILE }] }),
    });
    images.keepOnly.mockClear();
    await h['systems.personal.cleanup']({ systemId: 'plain' });
    expect(images.keepOnly).toHaveBeenCalledWith('plain', [FILE]);
  });

  it('FR-MUS-8: without a library, addImages fails LIBRARY_UNAVAILABLE and cleanup deletes nothing', async () => {
    personalRepo = null;
    picked = ['C:/x/a.png'];
    const h = handlers();
    expect(await code(() => h['systems.personal.addImages']({ systemId: 'plain' }))).toBe(
      'LIBRARY_UNAVAILABLE',
    );
    expect(images.add).not.toHaveBeenCalled();
    await h['systems.personal.cleanup']({ systemId: 'plain' });
    expect(images.keepOnly).not.toHaveBeenCalled();
  });

  it('FR-MUS-8: an unreadable stored record is never used to prune images (cleanup or save)', async () => {
    lib.db.$client
      .prepare("insert into system_personal (system_id, data, updated_at) values (?, ?, 'x')")
      .run('plain', 'not json');
    const h = handlers();
    await h['systems.personal.cleanup']({ systemId: 'plain' });
    await h['systems.personal.save']({
      systemId: 'plain',
      personal: mine('plain', { notes: 'fresh' }),
    });
    expect(images.keepOnly).not.toHaveBeenCalled();
    expect(await h['systems.personal.get']({ systemId: 'plain' })).toEqual(
      mine('plain', { notes: 'fresh' }),
    );
  });
});
