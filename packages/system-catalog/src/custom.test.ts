import type { CustomSystem } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { customSystemDefinition, findSystem, withCustomSystems } from './custom.ts';
import { systemCatalog } from './index.ts';

const SWITCH_2: CustomSystem = {
  id: 'custom-nintendo-switch-2',
  name: 'Nintendo Switch 2',
  shortName: 'Switch 2',
  manufacturer: 'Nintendo',
  releaseYear: 2025,
  kind: 'handheld',
  description: 'Hybrid console.',
  folderName: 'Nintendo Switch 2',
  extensions: ['xci', 'nsp'],
  screenscraperId: 300,
};

describe('custom systems in the catalog (FR-EMU-11)', () => {
  it('FR-EMU-11: a custom system reads as a catalog definition', () => {
    expect(customSystemDefinition(SWITCH_2)).toEqual({
      id: 'custom-nintendo-switch-2',
      name: 'Nintendo Switch 2',
      shortName: 'Switch 2',
      manufacturer: 'Nintendo',
      releaseYear: 2025,
      kind: 'handheld',
      description: 'Hybrid console.',
      extensions: ['xci', 'nsp'],
      defaultFolderName: 'Nintendo Switch 2',
      scraper: { screenscraperId: 300 },
      presetProfiles: [],
      aliases: [],
    });
  });

  it('FR-EMU-11: custom systems are placed among the shipped ones by name', () => {
    const all = withCustomSystems(systemCatalog(), [
      { ...SWITCH_2, id: 'custom-zz-last', name: 'zz last' },
      SWITCH_2,
      { ...SWITCH_2, id: 'custom-aa-first', name: 'AA first' },
    ]);
    expect(all).toHaveLength(systemCatalog().length + 3);
    const names = all.map((system) => system.name);
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    );
    const at = names.indexOf('Nintendo Switch 2');
    expect(names.slice(at - 1, at + 2)).toEqual([
      'Nintendo Switch',
      'Nintendo Switch 2',
      'Nintendo Virtual Boy',
    ]);
    expect(names[0]).toBe('AA first');
    expect(names.at(-1)).toBe('zz last');
    expect(findSystem(all, 'custom-nintendo-switch-2')?.name).toBe('Nintendo Switch 2');
    expect(findSystem(all, 'nintendo-64')?.name).toBe('Nintendo 64');
  });

  it('FR-EMU-11: without custom systems the shipped list is returned as is', () => {
    expect(withCustomSystems(systemCatalog(), [])).toBe(systemCatalog());
  });
});
