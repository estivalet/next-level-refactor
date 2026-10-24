import { describe, expect, it } from 'vitest';
import { extractRegion, normalizeTitle, queryVariants, similarity } from './titles.ts';

// Cases ported from NextLevelOS scrappers/test_scrape_library.py with invented titles.

describe('normalizeTitle (FR-SCR-1)', () => {
  it.each([
    ['Dr. Gizmo', 'dr gizmo'],
    ['Turbo Rally Bros. 3', 'turbo rally bros 3'],
    ['Blip-Blop / Zorbo', 'blip blop zorbo'],
  ])('title mode keeps the full title: %s', (title, expected) => {
    expect(normalizeTitle(title, { isTitle: true })).toBe(expected);
  });

  it('filename mode drops the path, extension and tags', () => {
    expect(normalizeTitle('Dr. Gizmo')).toBe('dr');
    expect(normalizeTitle('Orbit (USA).zip')).toBe('orbit');
    expect(normalizeTitle('roms/Orbit Racer (Europe) [!].sfc')).toBe('orbit racer');
  });

  it('drops accents, punctuation, region words and a leading article', () => {
    expect(normalizeTitle("The Café's Quest: Part II", { isTitle: true })).toBe(
      'cafe s quest part ii',
    );
    expect(normalizeTitle('Star Hop USA Beta', { isTitle: true })).toBe('star hop');
  });
});

describe('extractRegion', () => {
  it.each([
    ['Foo (Europe)', 'eu'],
    ['Foo (USA, Europe)', 'us'],
    ['Foo [Japan]', 'jp'],
    ['Foo (Brasil)', null],
    ['Foo (Rev 1) (Brazil)', 'br'],
    ['Foo', null],
  ])('%s → %s', (name, region) => {
    expect(extractRegion(name)).toBe(region);
  });
});

describe('queryVariants', () => {
  it('relaxes by dropping one or two leading/trailing words, keeping two or more', () => {
    expect(queryVariants('a b c d')).toEqual(['a b c d', 'a b c', 'b c d', 'a b', 'c d']);
    expect(queryVariants('a b c')).toEqual(['a b c', 'a b', 'b c']);
  });

  it('keeps a one-word query as is', () => {
    expect(queryVariants('orbit')).toEqual(['orbit']);
  });
});

describe('similarity', () => {
  it('is 100 for equal strings, ignoring case and outer spaces', () => {
    expect(similarity(' Orbit ', 'orbit')).toBe(100);
  });

  it('is Levenshtein-based and 0 when one side is empty', () => {
    expect(similarity('turbo rally bros 3', 'turbo rally bros')).toBeCloseTo(88.89, 2);
    expect(similarity('', 'x')).toBe(0);
  });
});
