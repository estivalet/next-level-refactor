import { describe, expect, it } from 'vitest';
import {
  GeneralSchema,
  SettingsSchema,
  defaultSettings,
  fieldMeta,
  normalizePath,
  orderedLocations,
} from './schema.ts';

describe('SettingsSchema', () => {
  it('FR-SET-2: an empty file with schemaVersion 2 is valid and gets defaults', () => {
    expect(SettingsSchema.parse({ schemaVersion: 2 })).toEqual(defaultSettings());
    expect(defaultSettings().general).toEqual({
      language: 'en',
      bootTarget: { kind: 'lastTheme' },
      startWithWindows: false,
      setupCompletedAt: null,
      setupRequested: false,
      lastRoot: null,
    });
  });

  it('FR-SET-2: wrong types fail with the field path', () => {
    const result = SettingsSchema.safeParse({ schemaVersion: 2, general: { language: 'xx' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['general', 'language']);
  });

  it('unknown keys are stripped', () => {
    const parsed = SettingsSchema.parse({ schemaVersion: 2, general: { langauge: 'pt-BR' }, x: 1 });
    expect(parsed).toEqual(defaultSettings());
  });

  it('schemaVersion other than the current one fails (older files go through migrate)', () => {
    expect(SettingsSchema.safeParse({ schemaVersion: 1 }).success).toBe(false);
  });

  it('fieldMeta returns label keys for form fields only', () => {
    expect(fieldMeta(GeneralSchema.shape.language)).toEqual({
      labelKey: 'settings.fields.general.language.label',
      helpKey: 'settings.fields.general.language.help',
    });
    expect(fieldMeta(GeneralSchema.shape.setupCompletedAt)).toBeUndefined();
  });
});

const LOCATION_ID = '01928c3e-0000-7000-8000-000000000001';
const OTHER_ID = '01928c3e-0000-7000-8000-000000000002';
const location = (over: Record<string, unknown> = {}) => ({
  id: LOCATION_ID,
  name: '2TB',
  path: 'E:\\roms',
  priority: 1,
  ...over,
});

function issuePaths(input: unknown): string[] {
  const result = SettingsSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('storage and systems settings', () => {
  it('FR-LIB-1: storage locations default to none and systems to empty', () => {
    expect(defaultSettings().storage).toEqual({
      locations: [],
      assetsPath: null,
      themesPath: null,
      media: { mode: 'perRomFolder' },
    });
    expect(defaultSettings().systems).toEqual({});
  });

  it('FR-LIB-1: a duplicate path differing only by case or trailing slash is rejected', () => {
    const paths = issuePaths({
      schemaVersion: 2,
      storage: {
        locations: [
          location(),
          location({ id: OTHER_ID, name: '16TB', path: 'e:/ROMS/', priority: 2 }),
        ],
      },
    });
    expect(paths).toEqual(['storage.locations.1.path']);
  });

  it('FR-LIB-1: duplicate names are rejected', () => {
    const paths = issuePaths({
      schemaVersion: 2,
      storage: { locations: [location(), location({ id: OTHER_ID, path: 'F:\\', priority: 2 })] },
    });
    expect(paths).toEqual(['storage.locations.1.name']);
  });

  it('FR-LIB-1: relative paths are rejected', () => {
    expect(
      issuePaths({ schemaVersion: 2, storage: { locations: [location({ path: 'roms' })] } }),
    ).toEqual(['storage.locations.0.path']);
  });

  it('FR-LIB-1: UNC paths are accepted', () => {
    expect(
      issuePaths({
        schemaVersion: 2,
        storage: { locations: [location({ path: '\\\\nas\\roms' })] },
      }),
    ).toEqual([]);
  });

  it('FR-LIB-2: a folder name with : is rejected', () => {
    expect(
      issuePaths({ schemaVersion: 2, systems: { 'nintendo-64': { folderName: 'N64: carts' } } }),
    ).toEqual(['systems.nintendo-64.folderName']);
  });

  it('FR-LIB-2: extension overrides must be lowercase without dots', () => {
    expect(
      issuePaths({ schemaVersion: 2, systems: { 'nintendo-64': { extensions: ['.Z64'] } } }),
    ).toEqual(['systems.nintendo-64.extensions.0']);
  });

  it('unknown system ids are kept', () => {
    const parsed = SettingsSchema.parse({
      schemaVersion: 2,
      systems: { 'future-console': { enabled: true } },
    });
    expect(parsed.systems['future-console']).toEqual({ enabled: true });
  });

  it('orderedLocations renumbers priority by order', () => {
    expect(
      orderedLocations([
        location({ priority: 7 }),
        location({ id: OTHER_ID, name: 'b', path: 'F:\\', priority: 3 }),
      ]).map((l) => l.priority),
    ).toEqual([1, 2]);
  });

  it('normalizePath ignores case, slash style and trailing separators', () => {
    expect(normalizePath('e:/ROMS/')).toBe(normalizePath('E:\\roms'));
  });
});

describe('themes and boot target settings (FR-THM-5, FR-THM-4)', () => {
  it('defaults: boot into the last theme, Big Box first, no overrides', () => {
    const settings = defaultSettings();
    expect(settings.general.bootTarget).toEqual({ kind: 'lastTheme' });
    expect(settings.themes).toEqual({
      activeDefault: 'big-box',
      lastUsed: null,
      entries: {},
      sound: { enabled: true, volume: 50 },
    });
  });

  it('accepts each boot target kind', () => {
    for (const bootTarget of [
      { kind: 'lastTheme' },
      { kind: 'theme', themeId: 'big-box' },
      { kind: 'desktop' },
    ]) {
      expect(
        SettingsSchema.parse({ schemaVersion: 2, general: { bootTarget } }).general.bootTarget,
      ).toEqual(bootTarget);
    }
  });

  it('a chosen theme needs a valid theme id', () => {
    expect(
      issuePaths({
        schemaVersion: 2,
        general: { bootTarget: { kind: 'theme', themeId: 'Bad Id' } },
      }),
    ).toEqual(['general.bootTarget.themeId']);
  });

  it('an unknown but well-formed theme id is kept (it falls back to Big Box at use)', () => {
    const parsed = SettingsSchema.parse({
      schemaVersion: 2,
      themes: {
        lastUsed: 'future-theme',
        entries: { 'future-theme': { art: { logoVariant: 'x' } } },
      },
    });
    expect(parsed.themes.lastUsed).toBe('future-theme');
    expect(parsed.themes.entries['future-theme']).toEqual({ art: { logoVariant: 'x' } });
  });

  it('D7: theme sounds default on at volume 50, volume 0–100', () => {
    expect(defaultSettings().themes.sound).toEqual({ enabled: true, volume: 50 });
    expect(
      issuePaths({ schemaVersion: 2, themes: { sound: { enabled: false, volume: 101 } } }),
    ).toEqual(['themes.sound.volume']);
    expect(issuePaths({ schemaVersion: 2, themes: { sound: { volume: 2.5 } } })).toEqual([
      'themes.sound.volume',
    ]);
  });

  it('FR-THM-4: a theme’s settings are checked against its own schema', () => {
    expect(
      issuePaths({
        schemaVersion: 2,
        themes: {
          entries: {
            hyperspin: { settings: { filtersInMenu: 'no', wheel: { itemHeight: 9000 } } },
            'big-box': { settings: { anything: 1 } },
            'future-theme': { settings: { wheel: 'x' } },
          },
        },
      }),
    ).toEqual([
      'themes.entries.hyperspin.settings.filtersInMenu',
      'themes.entries.hyperspin.settings.wheel.itemHeight',
    ]);
  });

  it('theme option overrides are validated like a pack theme.json', () => {
    expect(
      issuePaths({
        schemaVersion: 2,
        themes: { entries: { 'big-box': { art: { useVideoBackground: 'yes' } } } },
      }),
    ).toEqual(['themes.entries.big-box.art.useVideoBackground']);
  });

  it('FR-IMP-1: a system may override its ScreenScraper id with a positive integer', () => {
    const parse = (screenscraperId: unknown) =>
      SettingsSchema.safeParse({ schemaVersion: 2, systems: { snes: { screenscraperId } } });
    expect(parse(4).success).toBe(true);
    expect(parse(0).success).toBe(false);
    expect(parse(1.5).success).toBe(false);
  });
});

describe('scraper and media settings (FR-SCR-3, FR-SCR-4)', () => {
  it('defaults the scraper block and per-ROM media', () => {
    const settings = defaultSettings();
    expect(settings.schemaVersion).toBe(2);
    expect(settings.scraper).toEqual({
      regionPriority: ['us', 'eu', 'wor', 'jp'],
      languagePriority: [],
      artKinds: ['box-front', 'logo-clear', 'screenshot-game-play', 'fanart'],
      fields: ['description', 'year', 'developer', 'publisher', 'genre', 'players', 'rating'],
    });
    expect(settings.storage.media).toEqual({ mode: 'perRomFolder' });
  });

  it('accepts a central media folder only as an absolute path', () => {
    const central = (path: string) =>
      SettingsSchema.safeParse({ schemaVersion: 2, storage: { media: { mode: 'central', path } } });
    expect(central('D:/media').success).toBe(true);
    expect(central('media').success).toBe(false);
  });

  it('D16: rejects art kinds outside the list', () => {
    const result = SettingsSchema.safeParse({
      schemaVersion: 2,
      scraper: { artKinds: ['screenshot-select'] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed region and language codes', () => {
    expect(
      SettingsSchema.safeParse({ schemaVersion: 2, scraper: { regionPriority: ['USA!'] } }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ schemaVersion: 2, scraper: { languagePriority: ['english'] } })
        .success,
    ).toBe(false);
  });
});
