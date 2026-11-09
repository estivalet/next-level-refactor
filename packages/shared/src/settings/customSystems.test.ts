import { describe, expect, it } from 'vitest';
import { customSystemId, CustomSystemSchema } from './customSystems.ts';
import { SettingsSchema } from './schema.ts';

const SWITCH_2 = {
  id: 'custom-nintendo-switch-2',
  name: 'Nintendo Switch 2',
  folderName: 'Nintendo Switch 2',
  extensions: ['xci', 'nsp'],
};

describe('custom systems (FR-EMU-11)', () => {
  it('FR-EMU-11: a custom system needs only an id, name, folder and extensions', () => {
    expect(CustomSystemSchema.parse(SWITCH_2)).toEqual({ ...SWITCH_2, kind: 'console' });
  });

  it('FR-EMU-11: keeps the optional details', () => {
    const full = {
      ...SWITCH_2,
      shortName: 'Switch 2',
      manufacturer: 'Nintendo',
      releaseYear: 2025,
      kind: 'handheld',
      description: 'Hybrid console.',
      screenscraperId: 300,
      launchboxPlatform: 'Nintendo Switch 2',
    };
    expect(CustomSystemSchema.parse(full)).toEqual(full);
  });

  it('FR-EMU-11: ids start with custom- so they never clash with the catalog (ADR-011)', () => {
    expect(CustomSystemSchema.safeParse({ ...SWITCH_2, id: 'nintendo-switch-2' }).success).toBe(
      false,
    );
  });

  it('FR-EMU-11: names, folders and extensions are validated', () => {
    const parse = (patch: object) =>
      CustomSystemSchema.safeParse({ ...SWITCH_2, ...patch }).success;
    expect(parse({ name: '  ' })).toBe(false);
    expect(parse({ folderName: 'a/b' })).toBe(false);
    expect(parse({ extensions: [] })).toBe(false);
    expect(parse({ extensions: ['.xci'] })).toBe(false);
    expect(parse({ releaseYear: 1800 })).toBe(false);
  });

  it('FR-EMU-11: settings default to no custom systems', () => {
    expect(SettingsSchema.parse({ schemaVersion: 2 }).customSystems).toEqual([]);
  });

  it('FR-EMU-11: duplicate ids and names are reported on the later entry', () => {
    const result = SettingsSchema.safeParse({
      schemaVersion: 2,
      customSystems: [SWITCH_2, { ...SWITCH_2, name: 'nintendo switch 2 ' }],
    });
    expect(result.success).toBe(false);
    const issues = result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]);
    expect(issues).toContainEqual(['customSystems.1.id', 'duplicateSystemId']);
    expect(issues).toContainEqual(['customSystems.1.name', 'duplicateSystemName']);
  });
});

describe('customSystemId (FR-EMU-11)', () => {
  it('FR-EMU-11: slugs the name with a custom- prefix', () => {
    expect(customSystemId('Nintendo Switch 2', [])).toBe('custom-nintendo-switch-2');
    expect(customSystemId('Neo Geo+ Pocket!', [])).toBe('custom-neo-geo-plus-pocket');
  });

  it('FR-EMU-11: adds a number when the id is taken', () => {
    const taken = ['custom-nintendo-switch-2', 'custom-nintendo-switch-2-2'];
    expect(customSystemId('Nintendo Switch 2', taken)).toBe('custom-nintendo-switch-2-3');
  });

  it('FR-EMU-11: a name without letters or digits still gets an id', () => {
    expect(customSystemId('!!!', [])).toBe('custom-system');
  });
});
