import type { ImportItem } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapGames, normalizeRelPath, parseLastPlayed, type GameImport } from './mapGames.ts';
import { createSystemMatcher } from './matchSystem.ts';
import { readLegacy, type LegacyFiles } from './readLegacy.ts';
import { legacyCopy, type LegacyCopy } from './testing.ts';

let copy: LegacyCopy;
let files: LegacyFiles;
beforeAll(async () => {
  copy = await legacyCopy();
  files = (await readLegacy(copy.data)).files;
});
afterAll(() => copy.cleanup());

const match = createSystemMatcher(systemCatalog());
const run = (retroarchDir: string | null = 'E:\\RA') => mapGames(files, match, { retroarchDir });
const game = (entries: GameImport[], systemId: string, relPath: string) =>
  entries.find((e) => e.systemId === systemId && e.relPath === relPath);
const item = (items: ImportItem[], key: string, reason: ImportItem['reason']) =>
  items.find((i) => i.key === key && i.reason === reason);

describe('normalizeRelPath', () => {
  it('FR-IMP-1: strips ./, turns backslashes into slashes and trims', () => {
    expect(normalizeRelPath('./Pixel Quest.a26')).toBe('Pixel Quest.a26');
    expect(normalizeRelPath('.\\Homebrew\\Star Drifter.bin')).toBe('Homebrew/Star Drifter.bin');
    expect(normalizeRelPath('  Moon Hopper.a26 ')).toBe('Moon Hopper.a26');
  });

  it('FR-IMP-1: empty names and bare folders are invalid', () => {
    expect(normalizeRelPath('')).toBeNull();
    expect(normalizeRelPath('./')).toBeNull();
    expect(normalizeRelPath('../outside.zip')).toBeNull();
  });
});

describe('parseLastPlayed', () => {
  it('FR-IMP-1: reads NextLevelOS dates as local time and returns ISO', () => {
    expect(parseLastPlayed('7/21/2026, 7:49:00 PM')).toBe(
      new Date(2026, 6, 21, 19, 49, 0).toISOString(),
    );
    expect(parseLastPlayed('1/5/2026, 12:00:00 AM')).toBe(new Date(2026, 0, 5, 0, 0).toISOString());
    expect(parseLastPlayed('1/5/2026, 12:30:00 PM')).toBe(
      new Date(2026, 0, 5, 12, 30).toISOString(),
    );
  });

  it('FR-IMP-1: anything else is null', () => {
    expect(parseLastPlayed('yesterday')).toBeNull();
    expect(parseLastPlayed('13/45/2026, 7:49:00 PM')).toBeNull();
    expect(parseLastPlayed(undefined)).toBeNull();
  });
});

describe('mapGames', () => {
  it('FR-IMP-1: maps metadata, flags and play history; the gamelist file names the system', () => {
    const { entries } = run();
    expect(game(entries, 'atari-2600', 'Homebrew/Star Drifter.bin')).toMatchObject({
      metadata: { title: 'Star Drifter', year: 1984, genre: 'Shooter' },
      filters: ['homebrew'],
      favorite: false,
      playCount: 0,
    });
    expect(game(entries, 'atari-2600', 'Moon Hopper.a26')).toMatchObject({
      metadata: { title: 'Moon Hopper' },
      hidden: true,
    });
    expect(game(entries, 'atari-2600', 'Moon Hopper.a26')?.metadata.year).toBeUndefined();
  });

  it('FR-IMP-1: duplicate entries merge (flags or, plays max, later date)', () => {
    const { entries, items } = run();
    expect(game(entries, 'atari-2600', 'Pixel Quest.a26')).toMatchObject({
      metadata: { title: 'Pixel Quest', year: 1983, players: '1-2' },
      filters: ['official'],
      favorite: true,
      playCount: 20,
      lastPlayedAt: new Date(2026, 6, 22, 10, 5, 30).toISOString(),
    });
    expect(entries.filter((e) => e.relPath.toLowerCase() === 'pixel quest.a26')).toHaveLength(1);
    expect(item(items, 'Atari 2600', 'duplicateEntry')?.count).toBe(1);
    expect(item(items, 'Atari 2600', 'invalidEntry')?.count).toBe(2);
  });

  it('FR-LIB-5: disc entries of one set become one game named after the set', () => {
    const { entries, items } = run();
    const sony = entries.filter((e) => e.systemId === 'sony-playstation');
    expect(sony.map((e) => [e.relPath, e.discGroup])).toEqual([
      ['Orbit Saga (Disc 1).chd', 'Orbit Saga'],
      ['Lost Signal.chd', null],
    ]);
    expect(sony[0]).toMatchObject({ playCount: 4, favorite: true });
    expect(item(items, 'Sony Playstation', 'discSet')?.count).toBe(1);
  });

  it('FR-EMU-4: per-game core, RetroArch config and shader become a launch override', () => {
    const { entries, items } = run();
    expect(game(entries, 'arcade', 'blastoid.zip')).toMatchObject({
      override: {
        core: 'fbneo_libretro',
        extraArgs: [
          '--appendconfig',
          'E:\\RA\\config\\arcade-realistic.cfg|E:\\RA\\config\\Arcade\\realistic\\blastoid.cfg',
          '--set-shader',
          'E:\\RA\\shaders\\shaders_slang\\crt\\crt-easy.slangp',
        ],
      },
      arcade: {
        rom: 'blastoid',
        parent: null,
        driver: 'inventd.cpp',
        manufacturer: 'Invented Arcade Co',
      },
    });
    expect(game(entries, 'arcade', 'blastoidj.zip')?.override).toBeNull();
    expect(item(items, 'Arcade', 'perGameEmulator')?.count).toBe(1);
    expect(item(items, 'Arcade', 'hookSetting')?.count).toBe(1);
    expect(item(items, 'Arcade', 'arcadeInfo')?.count).toBe(2);
  });

  it('FR-EMU-4: without RetroArch the config and shader are reported, the core still maps', () => {
    const { entries, items } = run(null);
    expect(game(entries, 'arcade', 'blastoid.zip')?.override).toEqual({
      core: 'fbneo_libretro',
      extraArgs: [],
    });
    expect(item(items, 'Arcade', 'retroarchNotFound')?.count).toBe(1);
  });

  it('FR-IMP-1: filter tags become slugs; folders and unknown systems are reported', () => {
    const { entries, items } = run();
    expect(game(entries, 'microsoft-msx', 'Brick Tale.rom')?.filters).toEqual([
      'msxdev',
      'msxdev-2003',
    ]);
    expect(item(items, 'Microsoft MSX', 'filterRenamed')?.count).toBe(1);
    expect(item(items, 'Microsoft MSX', 'folderEntry')?.count).toBe(1);
    expect(game(entries, 'microsoft-msx', 'programs')).toBeUndefined();
    expect(item(items, 'Imaginary Console', 'unknownSystem')?.count).toBe(2);
    expect(entries.some((e) => e.relPath.startsWith('Dream'))).toBe(false);
  });

  it('FR-IMP-1: scrape bookkeeping is reported as arriving with the scraper (M6)', () => {
    expect(item(run().items, 'Atari 2600', 'scrapeInM6')?.count).toBe(1);
  });

  it('FR-IMP-1: only system gamelists are games; collections are not', () => {
    const { entries } = run();
    expect(entries.some((e) => e.relPath === 'Hidden Gem.a26')).toBe(false);
  });
});
