import type { SystemDefinition } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { filterSystems, withSystem } from './filterSystems.ts';
import { defaultSettings } from '@nextlevel/shared';

const system = (id: string, name: string, manufacturer?: string): SystemDefinition => ({
  id,
  name,
  ...(manufacturer ? { manufacturer } : {}),
  kind: 'other',
  extensions: ['zip'],
  defaultFolderName: name,
  scraper: {},
  presetProfiles: [],
  aliases: [],
});

const SYSTEMS = [
  system('nintendo-64', 'Nintendo 64', 'Nintendo'),
  system('sega-saturn', 'Sega Saturn', 'Sega'),
  system('mame', 'MAME'),
];

describe('filterSystems', () => {
  it('FR-EMU-1: matches name, manufacturer or id, ignoring case', () => {
    expect(filterSystems(SYSTEMS, 'saturn', {}, 'all').map((s) => s.id)).toEqual(['sega-saturn']);
    expect(filterSystems(SYSTEMS, 'NINTENDO', {}, 'all').map((s) => s.id)).toEqual(['nintendo-64']);
    expect(filterSystems(SYSTEMS, 'mame', {}, 'all').map((s) => s.id)).toEqual(['mame']);
  });

  it('a blank query keeps every system', () => {
    expect(filterSystems(SYSTEMS, '  ', {}, 'all')).toHaveLength(3);
  });

  it('FR-EMU-1: "enabled only" keeps enabled systems', () => {
    const settings = { 'sega-saturn': { enabled: true }, mame: { enabled: false } };
    expect(filterSystems(SYSTEMS, '', settings, 'enabled').map((s) => s.id)).toEqual([
      'sega-saturn',
    ]);
  });
});

describe('withSystem', () => {
  it('FR-LIB-2: adds an entry when a system is changed', () => {
    const next = withSystem(defaultSettings(), 'nintendo-64', { enabled: true });
    expect(next.systems).toEqual({ 'nintendo-64': { enabled: true } });
  });

  it('removes the entry again when it is back to the defaults', () => {
    const enabled = withSystem(defaultSettings(), 'nintendo-64', { enabled: true });
    expect(withSystem(enabled, 'nintendo-64', { enabled: false }).systems).toEqual({});
  });

  it('FR-LIB-2: clearing an override removes that key', () => {
    const custom = withSystem(defaultSettings(), 'nintendo-64', { folderName: 'N64' });
    expect(withSystem(custom, 'nintendo-64', { folderName: undefined }).systems).toEqual({});
  });
});
