import { describe, expect, it } from 'vitest';
import {
  candidateRegion,
  candidateYear,
  extractMetadata,
  gameName,
  gameNames,
} from './metadata.ts';
import type { SsGame } from './types.ts';

const full: SsGame = {
  id: '9',
  noms: [
    { region: 'jp', text: 'Hoshi no Kishi' },
    { region: 'us', text: 'Star Knight' },
  ],
  regions: [{ nom: 'japan' }],
  synopsis: [
    { langue: 'fr', text: 'Un chevalier.' },
    { langue: 'en', text: ' A knight. ' },
  ],
  dates: [
    { region: 'jp', text: '1993-11-02' },
    { region: 'wor', text: '1994-03-01' },
  ],
  developpeur: { text: 'Invented Soft' },
  editeur: { text: 'Made Up Games' },
  genres: [
    {
      noms: [
        { langue: 'fr', text: 'Action' },
        { langue: 'en', text: 'Action RPG' },
      ],
    },
    { noms: [{ langue: 'en', text: 'Platform' }] },
  ],
  joueurs: { text: '1-2' },
  note: { text: '16' },
};

describe('extractMetadata (FR-SCR-1)', () => {
  it('reads every field in the preferred language and region', () => {
    expect(extractMetadata(full, ['en'])).toEqual({
      description: 'A knight.',
      year: 1994,
      developer: 'Invented Soft',
      publisher: 'Made Up Games',
      genre: 'Action RPG',
      players: '1-2',
      rating: 4,
    });
  });

  it('follows the language priority, then falls back to the first text', () => {
    expect(extractMetadata(full, ['fr', 'en'])).toMatchObject({
      description: 'Un chevalier.',
      genre: 'Action',
    });
    expect(extractMetadata(full, ['pt'])).toMatchObject({
      description: 'Un chevalier.',
      genre: 'Action',
    });
  });

  it('year prefers wor, us, eu, jp, then any region', () => {
    expect(extractMetadata({ id: '1', dates: [{ region: 'kr', text: '2001' }] }, ['en']).year).toBe(
      2001,
    );
    expect(
      extractMetadata({ id: '1', dates: [{ region: 'wor', text: 'unknown' }] }, ['en']).year,
    ).toBeNull();
  });

  it('rating converts 0–20 to 0–5 with one decimal; out-of-range or junk is null', () => {
    const rating = (text: string) => extractMetadata({ id: '1', note: { text } }, ['en']).rating;
    expect(rating('13')).toBe(3.3);
    expect(rating('20')).toBe(5);
    expect(rating('25')).toBeNull();
    expect(rating('abc')).toBeNull();
  });

  it('missing or malformed fields are null', () => {
    expect(
      extractMetadata({ id: '1', synopsis: 'x', genres: [{}], developpeur: 'y' }, ['en']),
    ).toEqual({
      description: null,
      year: null,
      developer: null,
      publisher: null,
      genre: null,
      players: null,
      rating: null,
    });
  });
});

describe('names and candidate facts', () => {
  it('lists every name once, in order', () => {
    expect(gameNames({ id: '1', noms: [{ text: 'A' }, { text: 'B' }, { text: 'A' }] })).toEqual([
      'A',
      'B',
    ]);
    expect(gameNames({ id: '1', noms: 'Solo' })).toEqual(['Solo']);
  });

  it('gameName follows the region priority, else the first name', () => {
    expect(gameName(full, ['us', 'jp'])).toBe('Star Knight');
    expect(gameName(full, ['eu'])).toBe('Hoshi no Kishi');
    expect(gameName({ id: '1' }, ['us'])).toBeNull();
  });

  it('candidate year and region', () => {
    expect(candidateYear(full)).toBe('1993');
    expect(candidateRegion(full)).toBe('jp');
    expect(candidateYear({ id: '1' })).toBeNull();
  });
});
