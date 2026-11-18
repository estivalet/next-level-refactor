import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImportRepository } from './ImportRepository.ts';
import { seedGames, tempLibrary } from './testing.ts';

const NOW = new Date(Date.UTC(2026, 10, 17));

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
  seedGames(library.db, 'switch', ['Celeste', 'Astral Chain']);
});
afterEach(() => library.cleanup());

const members = [
  { systemId: 'switch', relPath: 'Celeste.zip', discGroup: null },
  { systemId: 'switch', relPath: 'Astral Chain.zip', discGroup: null },
];

const sortOf = (id: number) =>
  library.db.$client.prepare('select sort from collections where id = ?').pluck().get(id);

describe('ImportRepository.upsertCollection', () => {
  it('FR-IMP-1, FR-LIB-8: an Essentials collection imports sorted by title, others manual', () => {
    const repo = new ImportRepository(library.db);
    const essentials = repo.upsertCollection(
      'nextlevelos:Nintendo Switch Essentials',
      'Nintendo Switch Essentials',
      members,
      NOW,
    );
    const picks = repo.upsertCollection('nextlevelos:Picks', 'Picks', members, NOW);
    expect(sortOf(essentials)).toBe('title');
    expect(sortOf(picks)).toBe('manual');
  });

  it('D12: re-import sets an Essentials collection back to title and another back to manual', () => {
    const repo = new ImportRepository(library.db);
    const essentials = repo.upsertCollection('nextlevelos:Essentials', 'Essentials', members, NOW);
    const picks = repo.upsertCollection('nextlevelos:Picks', 'Picks', members, NOW);
    library.db.$client.prepare("update collections set sort = 'year'").run();
    repo.upsertCollection('nextlevelos:Essentials', 'Essentials', members, NOW);
    repo.upsertCollection('nextlevelos:Picks', 'Picks', members, NOW);
    expect(sortOf(essentials)).toBe('title');
    expect(sortOf(picks)).toBe('manual');
  });
});
