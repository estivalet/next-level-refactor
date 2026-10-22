import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { builtInNames, seedBuiltInSmartFilters } from './builtInSmartFilters.ts';
import { SmartFilterRepository } from './SmartFilterRepository.ts';
import { tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
let repo: SmartFilterRepository;
beforeEach(async () => {
  library = await tempLibrary();
  repo = new SmartFilterRepository(library.db, () => new Date(Date.UTC(2026, 9, 22)));
});
afterEach(async () => {
  await library.cleanup();
});

describe('built-in smart filters (FR-LIB-9, D10)', () => {
  it('names come from the UI language', () => {
    expect(builtInNames('en')).toEqual({
      favorites: 'Favorites',
      recent: 'Recently played',
      mostPlayed: 'Most played',
    });
    expect(builtInNames('pt-BR')).toEqual({
      favorites: 'Favoritos',
      recent: 'Jogados recentemente',
      mostPlayed: 'Mais jogados',
    });
  });

  it('are created once, in the language of the first start', () => {
    seedBuiltInSmartFilters(repo, 'pt-BR');
    seedBuiltInSmartFilters(repo, 'en');
    expect(repo.list().map((filter) => filter.name)).toEqual([
      'Favoritos',
      'Jogados recentemente',
      'Mais jogados',
    ]);
  });
});
