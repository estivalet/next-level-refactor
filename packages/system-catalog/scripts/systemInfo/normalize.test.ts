import { describe, expect, it } from 'vitest';
import { SystemInfoSchema } from '@nextlevel/shared';
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
    expect(entry.description?.endsWith('…')).toBe(true);
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
        { name: 'Fake Mk2', image: 'https://upload.wikimedia.org/a.png', price_uk: '£199' },
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
      { name: 'Fake Mk2', imageUrl: 'https://upload.wikimedia.org/a.png', launchPrice: '£199' },
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

  it('FR-MUS-5: Wikipedia source, with its licence link, only when story text exists', () => {
    expect(normalizeScraped({ cpu: 'Z80' }).entry.sources).toEqual([]);
    expect(normalizeScraped({ legado: 'Fake legacy' }).entry.sources).toEqual([
      { name: 'Wikipedia (CC BY-SA 4.0)', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ]);
    expect(normalizeScraped({ impact: 'Fake impact' }).entry.history).toBe('Fake impact');
  });

  it('FR-MUS-5: a Wikipedia article in references becomes the first source, licence second', () => {
    const result = normalizeScraped({
      description: 'Fake text',
      references: [
        'https://old-computers.example/fake',
        'https://en.wikipedia.org/wiki/Fake_Console',
        'https://en.wikipedia.org/wiki/Fake_Other',
      ],
    });
    expect(result.entry.sources).toEqual([
      { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Fake_Console' },
      { name: 'Wikipedia (CC BY-SA 4.0)', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    ]);
    expect(result.dropped).not.toContain('references');
  });

  it('FR-MUS-1: over-long text is cut at a word boundary with an ellipsis and reported', () => {
    const generationText = 'Third generation '.repeat(20);
    const priceText = 'US$199 bundled with a pad '.repeat(20);
    const result = normalizeScraped({
      generation: generationText,
      models: [{ model_name: 'Rev A', price_at_launch: priceText }],
    });
    // Cut ends a whole word: the kept text is a prefix followed by a space in the original.
    const endsOnWord = (cut: string | undefined, full: string): boolean =>
      cut !== undefined &&
      cut.endsWith('…') &&
      full.startsWith(cut.slice(0, -1)) &&
      full.charAt(cut.length - 1) === ' ';
    const { generation } = result.entry;
    const price = result.entry.models[0]?.launchPrice;
    expect(generation?.length).toBeLessThanOrEqual(120);
    expect(endsOnWord(generation, generationText)).toBe(true);
    expect(price?.length).toBeLessThanOrEqual(200);
    expect(endsOnWord(price, priceText)).toBe(true);
    expect(result.dropped).toEqual(
      expect.arrayContaining(['generation (truncated)', 'models.launchPrice (truncated)']),
    );
    expect(normalizeScraped({ generation: 'Third' }).dropped).toEqual([]);
  });

  it('FR-MUS-1: placeholder and non-image model image links are dropped and reported', () => {
    const images = [
      'https://example.com/a.png',
      'https://cdn.example.org/a.jpg',
      'https://fake.test/page.html',
      'https://fake.test/photo.JPG?size=large',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/fake',
    ];
    const result = normalizeScraped({
      models: images.map((image, i) => ({ model_name: `M${String(i)}`, image })),
    });
    expect(result.entry.models.map((model) => model.imageUrl)).toEqual([
      undefined,
      undefined,
      undefined,
      'https://fake.test/photo.JPG?size=large',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/fake',
    ]);
    expect(result.dropped).toEqual(['imageUrl (not an image link)']);
  });
  it('FR-MUS-1: an empty list key does not hide a populated alias, and a non-array list is dropped', () => {
    const picked = normalizeScraped({ models: [], modelos: [{ model_name: 'Rev A' }] });
    expect(picked.entry.models.map((m) => m.name)).toEqual(['Rev A']);
    const bad = normalizeScraped({ peripherals: 'Pad, Stick', notable_games: { a: 1 } });
    expect(bad.entry.peripherals).toEqual([]);
    expect(bad.dropped).toEqual(expect.arrayContaining(['peripherals', 'notable_games']));
  });

  it('FR-MUS-1: a rich normalized entry validates against SystemInfoSchema', () => {
    const { entry } = normalizeScraped({
      full_name: 'Fake Console One',
      brand: 'Acme',
      release_year: '1981-06-01',
      discontinued_year: 1985,
      description: 'A console.',
      cpu: ['Z80', '3 MHz'],
      sales: 1200000,
      models: [{ model_name: 'Rev A', release_year: 1981, image: 'https://fake.test/a.png' }],
      peripherals: ['Pad', 42, ''],
      notable_games: [{ title: 'Game', year: 1982 }, 'Other'],
    });
    expect(SystemInfoSchema.parse({ systemId: 'x', ...entry }).models).toHaveLength(1);
  });
});
