import { defaultSettings, SettingsSchema, type ImportItem, type Settings } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapSettings } from './mapSettings.ts';
import { readLegacy, type LegacyFiles } from './readLegacy.ts';
import { legacyCopy, type LegacyCopy } from './testing.ts';

let copy: LegacyCopy;
let files: LegacyFiles;
let n = 0;
const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;

beforeAll(async () => {
  copy = await legacyCopy();
  files = (await readLegacy(copy.data)).files;
});
afterAll(() => copy.cleanup());

const run = (current: Settings = defaultSettings()) =>
  mapSettings(files, systemCatalog(), current, newId);
const has = (items: readonly ImportItem[], match: Partial<ImportItem>) =>
  items.some((item) => Object.entries(match).every(([k, v]) => item[k as keyof ImportItem] === v));

describe('mapSettings', () => {
  it('FR-IMP-1: storage locations arrive in NextLevelOS priority order', () => {
    const { next } = run();
    expect(next.storage.locations.map((l) => [l.name, l.priority])).toEqual([
      ['Big', 1],
      ['Fast', 2],
      ['Old', 3],
    ]);
    expect(next.storage.locations[0]?.path.toLowerCase()).toBe(
      `${copy.root}\\roms\\b`.toLowerCase(),
    );
  });

  it('FR-IMP-1: a location already here (other slashes or case) is kept, not duplicated', () => {
    const current = SettingsSchema.parse({
      schemaVersion: 1,
      storage: {
        locations: [{ id: newId(), name: 'Mine', path: `${copy.root}\\ROMS\\A\\`, priority: 1 }],
      },
    });
    const { next } = run(current);
    expect(next.storage.locations.map((l) => l.name)).toEqual(['Mine', 'Big', 'Old']);
  });

  it('FR-IMP-1: systems with a gamelist or menu node are enabled with their folder and extensions', () => {
    const { next, items } = run();
    const enabled = Object.entries(next.systems)
      .filter(([, s]) => s.enabled)
      .map(([id]) => id)
      .sort();
    expect(enabled).toEqual([
      'amstrad-gx4000',
      'arcade',
      'atari-2600',
      'flash-games',
      'microsoft-msx',
      'nintendo-64',
      'nintendo-nes',
      'sony-playstation',
    ]);
    // NextLevelOS scanned scanExtensions plus romext: romext adds to the catalog's list.
    const gx4000 = systemCatalog().find((s) => s.id === 'amstrad-gx4000');
    expect(next.systems['amstrad-gx4000']).toMatchObject({
      folderName: 'GX4000 Carts',
      extensions: [...(gx4000?.extensions ?? []), 'xyz'],
    });
    // MSX's romext 'rom' is already in the catalog's list: no override.
    expect(next.systems['microsoft-msx']?.extensions).toBeUndefined();
    expect(next.systems['sega-genesis']?.enabled ?? false).toBe(false);
    expect(has(items, { area: 'system', key: 'Amstrad GX4000', reason: 'folderName' })).toBe(true);
  });

  it('FR-IMP-1: unknown systems, custom commands and outside folders are reported', () => {
    const { items } = run();
    expect(has(items, { area: 'system', key: 'Imaginary Console', reason: 'unknownSystem' })).toBe(
      true,
    );
    expect(
      items.find((item) => item.reason === 'customCommand' && item.key === 'Flash Games')?.detail,
    ).toBe('c:/Emu/flashplayer/flashplayer.exe "%romfilename%"');
    expect(
      items.find((item) => item.reason === 'absoluteRompath' && item.key === 'Nintendo NES')
        ?.detail,
    ).toBe('d:/Elsewhere/Nintendo NES');
  });

  it('FR-IMP-1: runner hook settings and test keys are reported, never kept', () => {
    const { items } = run();
    expect(has(items, { area: 'config', key: 'squashfs.exe', reason: 'hookSetting' })).toBe(true);
    expect(has(items, { area: 'config', key: 'wsl.distro.name', reason: 'hookSetting' })).toBe(
      true,
    );
    expect(has(items, { area: 'config', key: 'test.mode', reason: 'dropped' })).toBe(true);
  });

  it('FR-IMP-1: theme art maps system names to ids; unknown names and themes are reported', () => {
    const { next, items } = run();
    expect(next.themes.activeDefault).toBe('hyperspin');
    expect(next.themes.entries['big-box']?.art?.gameArt).toEqual({ 'nintendo-64': ['box-front'] });
    expect(next.themes.entries['hyperspin']).toMatchObject({
      art: { logoVariant: 'steel', useVideoBackground: true },
      settings: { filtersInMenu: false },
    });
    expect(has(items, { area: 'theme', key: 'Imaginary Console', reason: 'unknownSystem' })).toBe(
      true,
    );
    expect(has(items, { area: 'theme', key: 'retired-theme', reason: 'unknownTheme' })).toBe(true);
    expect(next.themes.entries['retired-theme']).toBeUndefined();
  });

  it('FR-IMP-1: art folders and ScreenScraper ids that differ from the catalog are kept', () => {
    const { next, items } = run();
    expect(next.storage.assetsPath?.toLowerCase()).toBe(`${copy.root}\\assets`.toLowerCase());
    expect(next.storage.themesPath?.toLowerCase()).toBe(`${copy.root}\\themes`.toLowerCase());
    expect(next.systems['nintendo-64']?.screenscraperId).toBe(999);
    expect(next.systems['atari-2600']?.screenscraperId).toBeUndefined();
    expect(has(items, { area: 'scraper', key: 'Imaginary Console', reason: 'unknownSystem' })).toBe(
      true,
    );
  });

  it('FR-IMP-1: the result is valid settings and keeps what NextLevelOS does not set', () => {
    const current = SettingsSchema.parse({ schemaVersion: 1, general: { language: 'pt-BR' } });
    const { next } = run(current);
    expect(SettingsSchema.safeParse(next).success).toBe(true);
    expect(next.general.language).toBe('pt-BR');
  });
});
