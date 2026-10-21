import { describe, expect, it } from 'vitest';
import { ftsQuery } from './ftsQuery.ts';

describe('ftsQuery', () => {
  it('FR-LIB-10: search text becomes safe prefix tokens', () => {
    expect(ftsQuery('zelda')).toBe('"zelda"*');
    expect(ftsQuery('super  mario')).toBe('"super"* "mario"*');
    expect(ftsQuery('zelda:')).toBe('"zelda"*');
    expect(ftsQuery('Zelda II: "Adventure" OR *')).toBe('"Zelda"* "II"* "Adventure"* "OR"*');
    expect(ftsQuery('école')).toBe('"école"*');
    expect(ftsQuery('Mario 64')).toBe('"Mario"* "64"*');
  });

  it('FR-LIB-10: text under 2 characters or without letters and digits is no query', () => {
    for (const text of ['', 'a', ' ', '"', '*', '🎮', '  b  ', '-:-']) {
      expect(ftsQuery(text), text).toBeNull();
    }
  });
});
