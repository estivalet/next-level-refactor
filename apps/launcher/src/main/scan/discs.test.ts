import { describe, expect, it } from 'vitest';
import type { FoundGame } from '../library/LibraryRepository.ts';
import { groupDiscs, titleFromRelPath } from './discs.ts';

describe('titleFromRelPath', () => {
  it('FR-LIB-5: titles drop the extension and disc tag but keep region tags', () => {
    expect(titleFromRelPath('! Brazil/Saga (USA) (Disc 1).chd')).toBe('Saga (USA)');
    expect(titleFromRelPath('Super Demo (Europe) (Rev 1).zip')).toBe('Super Demo (Europe) (Rev 1)');
    expect(titleFromRelPath('Tape Game (Tape 2 Side B).tzx')).toBe('Tape Game');
    expect(titleFromRelPath('noext')).toBe('noext');
  });
});

const file = (relPath: string): FoundGame => ({
  relPath,
  locationId: 'a',
  size: 1,
  mtime: 1,
  discGroup: null,
});
const grouped = (paths: string[]) =>
  groupDiscs(paths.map(file)).map((game) => [game.relPath, game.discGroup]);

describe('groupDiscs', () => {
  it('FR-LIB-5: loose discs become one game, the first disc', () => {
    expect(grouped(['Saga (USA) (Disc 2).chd', 'Saga (USA) (Disc 1).chd', 'Other.chd'])).toEqual([
      ['Other.chd', null],
      ['Saga (USA) (Disc 1).chd', 'Saga (USA)'],
    ]);
  });

  it('FR-LIB-5: side A comes before side B of the same disc', () => {
    expect(grouped(['Tape Game (Tape 1 Side B).tzx', 'Tape Game (Tape 1 Side A).tzx'])).toEqual([
      ['Tape Game (Tape 1 Side A).tzx', 'Tape Game'],
    ]);
  });

  it('FR-LIB-5: a lone disc stays a single game without a group', () => {
    expect(grouped(['Solo (Tape 2).tzx'])).toEqual([['Solo (Tape 2).tzx', null]]);
  });

  it('FR-LIB-5: discs group only within the same folder', () => {
    expect(grouped(['A/Saga (Disc 1).chd', 'B/Saga (Disc 2).chd'])).toEqual([
      ['A/Saga (Disc 1).chd', null],
      ['B/Saga (Disc 2).chd', null],
    ]);
  });

  it('FR-LIB-5: an m3u named like a disc group replaces the group', () => {
    expect(
      grouped(['Saga (USA).m3u', 'Saga (USA) (Disc 1).chd', 'Saga (USA) (Disc 2).chd']),
    ).toEqual([['Saga (USA).m3u', null]]);
  });
});
