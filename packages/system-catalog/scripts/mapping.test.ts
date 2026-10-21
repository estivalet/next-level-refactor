import { SystemCatalogSchema } from '@nextlevel/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog, parseEsSystems, slugify, type SeedInput } from './mapping.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

function input(overrides: Partial<SeedInput> = {}): SeedInput {
  return {
    launchers: JSON.parse(fixture('launchers.json')) as SeedInput['launchers'],
    globalExtensions: (JSON.parse(fixture('config.json')) as { scanExtensions: string[] })
      .scanExtensions,
    screenscraper: JSON.parse(fixture('screenscraper.json')) as Record<string, number>,
    esSystems: parseEsSystems(fixture('es_systems.xml')),
    aliases: { 'Nintendo NES': 'nes' },
    source: 'test',
    ...overrides,
  };
}

const system = (id: string) => {
  const found = buildCatalog(input()).catalog.systems.find((s) => s.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

describe('slugify', () => {
  it('FR-EMU-1: slugs are lowercase hyphenated ascii', () => {
    expect(slugify('Nintendo 64')).toBe('nintendo-64');
    expect(slugify('Sega Mega-Drive / Genesis')).toBe('sega-mega-drive-genesis');
    expect(slugify('Pokémon Mini')).toBe('pokemon-mini');
    expect(slugify('Arcade (MAME)')).toBe('arcade-mame');
  });

  it('FR-EMU-1: "+" is spelled out, so MSX2 and MSX2+ get different ids', () => {
    expect(slugify('Microsoft MSX2+')).toBe('microsoft-msx2-plus');
    expect(slugify('Taito Type X+')).toBe('taito-type-x-plus');
    expect(slugify('Microsoft MSX2')).toBe('microsoft-msx2');
  });
});

describe('parseEsSystems', () => {
  it('reads names and normalizes extensions', () => {
    expect(parseEsSystems(fixture('es_systems.xml'))[0]).toEqual({
      name: 'n64',
      fullname: 'Nintendo 64',
      extensions: ['n64', 'z64', '7z', 'zip'],
    });
  });
});

describe('buildCatalog', () => {
  it('FR-EMU-1: every NextLevelOS system becomes one entry, sorted by name, with its alias', () => {
    const { catalog } = buildCatalog(input());
    expect(catalog.systems.map((s) => s.name)).toEqual([
      'Apogee BK-01',
      'Arcade (MAME)',
      'Nintendo 64',
      'Nintendo NES',
      'Obscure Thing',
      'Pokémon Mini',
    ]);
    expect(system('nintendo-64')).toMatchObject({
      defaultFolderName: 'Nintendo 64',
      aliases: ['Nintendo 64'],
      presetProfiles: [],
    });
  });

  it('two names with the same slug fail the seed', () => {
    const launchers = { 'Sega Mega Drive': {}, 'Sega Mega-Drive': {} };
    expect(() => buildCatalog(input({ launchers }))).toThrow(/duplicate system id sega-mega-drive/);
  });

  it('extensions come from ES-DE when the fullname matches', () => {
    expect(system('nintendo-64').extensions).toEqual(['n64', 'z64', '7z', 'zip']);
  });

  it('an alias maps a renamed system to its ES-DE entry', () => {
    expect(system('nintendo-nes').extensions).toEqual(['nes', 'zip']);
  });

  it('else romext (lowercased, deduplicated), else the global list', () => {
    expect(system('apogee-bk-01').extensions).toEqual(['rka']);
    expect(system('obscure-thing').extensions).toEqual(['zip', '7z', 'iso']);
  });

  it('matching ignores accents and punctuation in the ES-DE fullname', () => {
    // "Pokémon Mini" vs ES-DE "Nintendo Pokémon Mini" does not match on its own…
    expect(system('pokemon-mini').extensions).toEqual(['zip', '7z', 'iso']);
    // …but an alias fixes it.
    const aliased = buildCatalog(input({ aliases: { 'Pokémon Mini': 'pokemini' } }));
    expect(aliased.catalog.systems.find((s) => s.id === 'pokemon-mini')?.extensions).toEqual([
      'min',
      'zip',
    ]);
  });

  it('Windows shortcut/script extensions are dropped unless they are all a system has', () => {
    const esSystems = [
      { name: 'n64', fullname: 'Nintendo 64', extensions: ['n64', 'z64', 'lnk', 'bat', 'url'] },
      { name: 'ags', fullname: 'Adventure Game Studio', extensions: ['bat', 'lnk'] },
    ];
    const launchers = { 'Nintendo 64': {}, 'Adventure Game Studio': {} };
    const { catalog } = buildCatalog(input({ launchers, esSystems, aliases: {} }));
    expect(catalog.systems.map((s) => s.extensions)).toEqual([
      ['bat', 'lnk'],
      ['n64', 'z64'],
    ]);
  });

  it('the report lists systems that fell back to the global list', () => {
    expect(buildCatalog(input()).report.fallbackExtensions).toEqual([
      'Arcade (MAME)',
      'Obscure Thing',
      'Pokémon Mini',
    ]);
  });

  it('known manufacturers and arcade kinds are filled; unknown ones stay empty/other', () => {
    expect(system('nintendo-64')).toMatchObject({ manufacturer: 'Nintendo', kind: 'other' });
    expect(system('arcade-mame').kind).toBe('arcade');
    expect(system('obscure-thing').manufacturer).toBeUndefined();
  });

  it('ScreenScraper ids come from screenscraper.json by name', () => {
    expect(system('nintendo-64').scraper).toEqual({ screenscraperId: 14 });
    expect(system('obscure-thing').scraper).toEqual({});
  });

  it('the result validates against SystemCatalogSchema', () => {
    expect(SystemCatalogSchema.safeParse(buildCatalog(input()).catalog).success).toBe(true);
  });
});
