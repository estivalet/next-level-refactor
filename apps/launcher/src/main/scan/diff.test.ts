import { describe, expect, it } from 'vitest';
import type { ExistingGame, FoundGame } from '../library/LibraryRepository.ts';
import { diffSystem } from './diff.ts';

const found = (relPath: string, size = 10): FoundGame => ({
  relPath,
  locationId: 'a',
  size,
  mtime: 1,
  discGroup: null,
});
const row = (id: number, relPath: string, size = 10, missing = false): ExistingGame => ({
  id,
  relPath,
  size,
  missing,
  locationId: 'a',
  mtime: 1,
  discGroup: null,
});

describe('diffSystem', () => {
  it('FR-LIB-3: diff finds new, present and restored games by case-insensitive rel_path', () => {
    const diff = diffSystem(
      [row(1, 'Game.zip'), row(2, 'Back.zip', 10, true)],
      [found('GAME.ZIP'), found('Back.zip'), found('New.zip')],
    );
    expect(diff).toEqual({
      added: [found('New.zip')],
      present: [
        { id: 1, game: found('GAME.ZIP') },
        { id: 2, game: found('Back.zip') },
      ],
      moved: [],
      restored: [2],
      missing: [],
      unchanged: 0,
    });
  });

  it('FR-LIB-3: a file moved to another folder keeps its id', () => {
    const diff = diffSystem([row(1, 'Game.zip')], [found('Sub/game.zip')]);
    expect(diff).toEqual({
      added: [],
      present: [],
      moved: [{ id: 1, game: found('Sub/game.zip') }],
      restored: [],
      missing: [],
      unchanged: 0,
    });
  });

  it('FR-LIB-3: a moved game that was missing is restored', () => {
    const diff = diffSystem([row(1, 'Game.zip', 10, true)], [found('Sub/Game.zip')]);
    expect(diff.moved).toEqual([{ id: 1, game: found('Sub/Game.zip') }]);
    expect(diff.restored).toEqual([1]);
  });

  it('FR-LIB-3: an ambiguous move is not guessed', () => {
    const diff = diffSystem([row(1, 'Game.zip')], [found('A/Game.zip'), found('B/Game.zip')]);
    expect(diff.moved).toEqual([]);
    expect(diff.added).toEqual([found('A/Game.zip'), found('B/Game.zip')]);
    expect(diff.missing).toEqual([1]);
  });

  it('FR-LIB-3: a file with the same name but another size is not a move', () => {
    const diff = diffSystem([row(1, 'Game.zip', 10)], [found('Sub/Game.zip', 11)]);
    expect(diff.moved).toEqual([]);
    expect(diff.missing).toEqual([1]);
  });

  it('FR-LIB-4: an already missing game stays missing without a new missing_since', () => {
    const diff = diffSystem([row(1, 'Gone.zip', 10, true)], []);
    expect(diff).toEqual({
      added: [],
      present: [],
      moved: [],
      restored: [],
      missing: [],
      unchanged: 0,
    });
  });

  it('FR-LIB-4: a present game that is not found goes missing', () => {
    expect(diffSystem([row(1, 'Gone.zip')], []).missing).toEqual([1]);
  });

  it('FR-LIB-3: a game found exactly as stored is counted, not rewritten', () => {
    const diff = diffSystem(
      [row(1, 'Same.zip'), row(2, 'Touched.zip'), row(3, 'Moved drive.zip')],
      [
        found('Same.zip'),
        { ...found('Touched.zip'), mtime: 2 },
        { ...found('Moved drive.zip'), locationId: 'b' },
      ],
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.present.map((p) => p.id)).toEqual([2, 3]);
  });
});
