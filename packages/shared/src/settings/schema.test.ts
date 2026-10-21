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
  it('FR-SET-2: an empty file with schemaVersion 1 is valid and gets defaults', () => {
    expect(SettingsSchema.parse({ schemaVersion: 1 })).toEqual(defaultSettings());
    expect(defaultSettings().general).toEqual({
      language: 'en',
      startWithWindows: false,
      setupCompletedAt: null,
    });
  });

  it('FR-SET-2: wrong types fail with the field path', () => {
    const result = SettingsSchema.safeParse({ schemaVersion: 1, general: { language: 'xx' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['general', 'language']);
  });

  it('unknown keys are stripped', () => {
    const parsed = SettingsSchema.parse({ schemaVersion: 1, general: { langauge: 'pt-BR' }, x: 1 });
    expect(parsed).toEqual(defaultSettings());
  });

  it('schemaVersion other than 1 fails', () => {
    expect(SettingsSchema.safeParse({ schemaVersion: 2 }).success).toBe(false);
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
    expect(defaultSettings().storage).toEqual({ locations: [] });
    expect(defaultSettings().systems).toEqual({});
  });

  it('FR-LIB-1: a duplicate path differing only by case or trailing slash is rejected', () => {
    const paths = issuePaths({
      schemaVersion: 1,
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
      schemaVersion: 1,
      storage: { locations: [location(), location({ id: OTHER_ID, path: 'F:\\', priority: 2 })] },
    });
    expect(paths).toEqual(['storage.locations.1.name']);
  });

  it('FR-LIB-1: relative paths are rejected', () => {
    expect(
      issuePaths({ schemaVersion: 1, storage: { locations: [location({ path: 'roms' })] } }),
    ).toEqual(['storage.locations.0.path']);
  });

  it('FR-LIB-1: UNC paths are accepted', () => {
    expect(
      issuePaths({
        schemaVersion: 1,
        storage: { locations: [location({ path: '\\\\nas\\roms' })] },
      }),
    ).toEqual([]);
  });

  it('FR-LIB-2: a folder name with : is rejected', () => {
    expect(
      issuePaths({ schemaVersion: 1, systems: { 'nintendo-64': { folderName: 'N64: carts' } } }),
    ).toEqual(['systems.nintendo-64.folderName']);
  });

  it('FR-LIB-2: extension overrides must be lowercase without dots', () => {
    expect(
      issuePaths({ schemaVersion: 1, systems: { 'nintendo-64': { extensions: ['.Z64'] } } }),
    ).toEqual(['systems.nintendo-64.extensions.0']);
  });

  it('unknown system ids are kept', () => {
    const parsed = SettingsSchema.parse({
      schemaVersion: 1,
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
