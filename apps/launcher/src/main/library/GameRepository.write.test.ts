import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffSystem } from '../scan/diff.ts';
import { GameRepository } from './GameRepository.ts';
import type { FoundGame } from './LibraryRepository.ts';
import { openLibrary } from './openLibrary.ts';
import { appErrorOf, seedGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 9, 21, 12, 0, 0));
const LATER = new Date(Date.UTC(2026, 9, 22, 12, 0, 0));

let library: Awaited<ReturnType<typeof tempLibrary>>;
let games: GameRepository;
beforeEach(async () => {
  library = await tempLibrary();
  games = new GameRepository(library.db, (row) => row.relPath);
});
afterEach(async () => {
  await library.cleanup();
});

const found = (relPath: string): FoundGame => ({
  relPath,
  locationId: 'loc-1',
  size: 1,
  mtime: 1,
  discGroup: null,
});
const searchTitles = (text: string) => games.search(text).games.map((game) => game.title);

describe('GameRepository.updateMetadata', () => {
  it('FR-LIB-6: editing metadata locks the edited fields and a rescan keeps them', () => {
    const [id = 0] = seedGames(library.db, 'nintendo-64', [
      { title: 'Racer', relPath: 'Racer.zip' },
    ]);
    const details = games.updateMetadata(id, { title: 'Racer Deluxe', genre: 'Racing' }, LATER);
    expect(details).toMatchObject({ title: 'Racer Deluxe', genre: 'Racing' });
    expect(details.lockedFields).toEqual(['genre', 'title']);
    expect(games.updateMetadata(id, { year: 1999, title: 'Racer DX' }, LATER).lockedFields).toEqual(
      ['genre', 'title', 'year'],
    );
    expect(searchTitles('deluxe')).toEqual([]);
    expect(searchTitles('racer dx')).toEqual(['Racer DX']);
    expect(
      library.db.$client
        .prepare('select sort_title from game_metadata where game_id = ?')
        .pluck()
        .get(id),
    ).toBe('racer dx');

    const diff = diffSystem(library.repo.listSystemGames('nintendo-64'), [found('Racer.zip')]);
    library.repo.applySystemDiff('nintendo-64', diff, LATER);
    expect(games.get(id).title).toBe('Racer DX');
  });

  it('FR-LIB-6: filters are replaced as a set', () => {
    const [id = 0] = seedGames(library.db, 'nintendo-64', ['Racer']);
    games.updateMetadata(id, { filters: ['homebrew', 'hack'] }, NOW);
    expect(games.get(id).filters).toEqual(['hack', 'homebrew']);
    expect(games.updateMetadata(id, { filters: ['translation'] }, NOW).filters).toEqual([
      'translation',
    ]);
  });

  it('FR-LIB-6: editing an unknown game is NOT_FOUND', () => {
    expect(appErrorOf(() => games.updateMetadata(42, { title: 'X' }, NOW)).code).toBe('NOT_FOUND');
  });
});

describe('GameRepository.setFlags', () => {
  it('FR-LIB-7: favorite, hidden and rating persist and can be cleared', () => {
    const [a = 0, b = 0] = seedGames(library.db, 'nintendo-64', ['Alpha', 'Bravo']);
    games.setFlags([a, b], { favorite: true, userRating: 4 });
    games.setFlags([b], { userRating: null, hidden: true });

    const file = library.db.$client.name;
    library.db.$client.close();
    const reopened = openLibrary(file, { backupsDir: `${file}.backups`, clock: () => NOW });
    const again = new GameRepository(reopened, (row) => row.relPath);
    expect(again.get(a)).toMatchObject({ favorite: true, hidden: false, userRating: 4 });
    expect(again.get(b)).toMatchObject({ favorite: true, hidden: true, userRating: null });
    reopened.$client.close();
  });

  it('FR-LIB-7: flags on an unknown game write nothing', () => {
    const [a = 0] = seedGames(library.db, 'nintendo-64', ['Alpha']);
    expect(
      appErrorOf(() => {
        games.setFlags([a, 999], { favorite: true });
      }).code,
    ).toBe('NOT_FOUND');
    expect(games.get(a).favorite).toBe(false);
  });
});

describe('GameRepository.relink', () => {
  it('FR-LIB-3: relink moves a missing game onto its new file and keeps its id and edits', () => {
    const [old = 0] = seedGames(library.db, 'nintendo-64', [
      { title: 'Game', relPath: 'Game.zip', missing: true, favorite: true },
    ]);
    games.updateMetadata(old, { title: 'My Game' }, NOW);
    const [replacement = 0] = seedGames(library.db, 'nintendo-64', [
      { title: 'Game (USA)', relPath: 'USA/Game (USA).zip', locationId: 'loc-2' },
    ]);

    const relinked = games.relink(old, replacement);
    expect(relinked).toMatchObject({
      id: old,
      relPath: 'USA/Game (USA).zip',
      missing: false,
      missingSince: null,
      title: 'My Game',
      favorite: true,
    });
    expect(appErrorOf(() => games.get(replacement)).code).toBe('NOT_FOUND');
    expect(searchTitles('game usa')).toEqual([]);

    const diff = diffSystem(library.repo.listSystemGames('nintendo-64'), [
      { ...found('USA/Game (USA).zip'), locationId: 'loc-2' },
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.missing).toEqual([]);
    expect(diff.moved).toEqual([]);
  });

  it('FR-LIB-3: relink refuses a present game, a missing replacement and another system', () => {
    const [missing = 0, present = 0, alsoMissing = 0] = seedGames(library.db, 'nintendo-64', [
      { title: 'Gone', missing: true },
      'Here',
      { title: 'Also Gone', missing: true },
    ]);
    const [elsewhere = 0] = seedGames(library.db, 'snes', ['Elsewhere']);
    const reason = (a: number, b: number) =>
      (appErrorOf(() => games.relink(a, b)).details as { reason: string }).reason;
    expect(reason(present, missing)).toBe('notMissing');
    expect(reason(missing, alsoMissing)).toBe('replacementMissing');
    expect(reason(missing, elsewhere)).toBe('otherSystem');
    expect(reason(missing, missing)).toBe('same');
    expect(appErrorOf(() => games.relink(missing, 999)).code).toBe('NOT_FOUND');
  });
});

describe('GameRepository.applyScraped', () => {
  it('FR-SCR-1, D19: scraped values fill unlocked fields and never lock them', () => {
    const [id = 0] = seedGames(library.db, 'snes', [{ title: 'Racer', genre: 'Old' }]);
    games.updateMetadata(id, { genre: 'Mine' }, NOW);
    const details = games.applyScraped(
      id,
      { genre: 'Racing', year: 1994, developer: 'Dev Co', rating: 4, description: 'Fast.' },
      { overrideLocked: [] },
      LATER,
    );
    expect(details).toMatchObject({
      genre: 'Mine',
      year: 1994,
      developer: 'Dev Co',
      rating: 4,
      description: 'Fast.',
    });
    expect(details.lockedFields).toEqual(['genre']);
  });

  it('D19: a locked field ticked on purpose is written and stays locked', () => {
    const [id = 0] = seedGames(library.db, 'snes', ['Racer']);
    games.updateMetadata(id, { genre: 'Mine' }, NOW);
    const details = games.applyScraped(
      id,
      { genre: 'Racing' },
      { overrideLocked: ['genre'] },
      LATER,
    );
    expect(details.genre).toBe('Racing');
    expect(details.lockedFields).toEqual(['genre']);
  });

  it('FR-SCR-1: a scraped title updates the sort title and search; null values are skipped', () => {
    const [id = 0] = seedGames(library.db, 'snes', [{ title: 'racer_v1', year: 1990 }]);
    const details = games.applyScraped(
      id,
      { title: 'Zoom Racer', year: null, players: '1-2' },
      { overrideLocked: [] },
      LATER,
    );
    expect(details).toMatchObject({ title: 'Zoom Racer', year: 1990, players: '1-2' });
    expect(searchTitles('zoom')).toEqual(['Zoom Racer']);
    expect(
      games.list({ scope: { kind: 'system', systemId: 'snes' }, tab: 'all', offset: 0, limit: 10 })
        .games[0]?.title,
    ).toBe('Zoom Racer');
  });

  it('FR-SCR-1: scraping an unknown game is NOT_FOUND', () => {
    expect(
      appErrorOf(() => games.applyScraped(999, { genre: 'x' }, { overrideLocked: [] }, NOW))?.code,
    ).toBe('NOT_FOUND');
  });
});
