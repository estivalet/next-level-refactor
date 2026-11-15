import { describe, expect, it } from 'vitest';
import { normalizeScraped } from './normalize.ts';

describe('normalizeScraped', () => {
  it('FR-MUS-1: normalizes snake_case, camelCase and Portuguese keys', () => {
    expect(normalizeScraped({ release_year: 1981 }).entry.releaseYear).toBe(1981);
    expect(normalizeScraped({ releaseDate: '1981-06-01' }).entry.releaseYear).toBe(1981);
    expect(normalizeScraped({ ano_de_lançamento: 1981 }).entry.releaseYear).toBe(1981);
    expect(normalizeScraped({ release_year: '1981' }).entry.releaseYear).toBe(1981);
    expect(normalizeScraped({ release_year_range: '1983-1986' }).entry.releaseYear).toBe(1983);
    expect(normalizeScraped({ release_year: 1700 }).entry.releaseYear).toBeUndefined();
  });

  it('FR-MUS-1: maps text keys, joins arrays and truncates over-long text', () => {
    const { entry } = normalizeScraped({
      full_name: '  Fake Console One ',
      brand: 'Acme',
      memory: ['4 KB', '8 KB'],
      storage_media: 'Cartridge',
      sales: 1200000,
      description: 'x'.repeat(25000),
      input_devices: ['Pad', 'Stick'],
      notable_successor: 'Fake Two',
    });
    expect(entry.fullName).toBe('Fake Console One');
    expect(entry.manufacturer).toBe('Acme');
    expect(entry.ram).toBe('4 KB; 8 KB');
    expect(entry.media).toBe('Cartridge');
    expect(entry.unitsSold).toBe('1200000');
    expect(entry.description).toHaveLength(20000);
    expect(entry.peripherals).toEqual(['Pad', 'Stick']);
    expect(entry.successor).toBe('Fake Two');
  });

  it('FR-MUS-1: models map name, year, price and http image only', () => {
    const { entry } = normalizeScraped({
      models: [
        {
          model_name: 'Fake Mk1',
          released: '1982',
          price_at_launch: '£399',
          memory: '16 KB',
          description: 'Fake notes',
          image_example: 'ftp://x',
        },
        { name: 'Fake Mk2', image: 'https://example.com/a.png', price_uk: '£199' },
        { price_at_launch: 'no name, skipped' },
      ],
    });
    expect(entry.models).toEqual([
      {
        name: 'Fake Mk1',
        releaseYear: 1982,
        launchPrice: '£399',
        ram: '16 KB',
        notes: 'Fake notes',
      },
      { name: 'Fake Mk2', imageUrl: 'https://example.com/a.png', launchPrice: '£199' },
    ]);
  });

  it('FR-MUS-3: top games accept strings and objects', () => {
    const { entry } = normalizeScraped({
      notable_games: ['Fake Quest', { title: 'Fake Racer', year: '1984' }, { name: 'Fake Bird' }],
    });
    expect(entry.topGames).toEqual([
      { title: 'Fake Quest' },
      { title: 'Fake Racer', year: 1984 },
      { title: 'Fake Bird' },
    ]);
  });

  it('FR-MUS-1: unknown keys are reported as dropped', () => {
    const result = normalizeScraped({ name: 'X', custom_chips: 'Y' });
    expect(result.dropped).toContain('custom_chips');
    expect(result.dropped).not.toContain('name');
  });

  it('FR-MUS-1: non-object input gives an empty entry', () => {
    const result = normalizeScraped(42);
    expect(result.entry.models).toEqual([]);
    expect(result.entry.topGames).toEqual([]);
    expect(result.entry.sources).toEqual([]);
  });

  it('FR-MUS-5: Wikipedia source only when story text exists', () => {
    expect(normalizeScraped({ cpu: 'Z80' }).entry.sources).toEqual([]);
    expect(normalizeScraped({ legado: 'Fake legacy' }).entry.sources).toEqual([
      { name: 'Wikipedia' },
    ]);
    expect(normalizeScraped({ impact: 'Fake impact' }).entry.history).toBe('Fake impact');
  });
});
