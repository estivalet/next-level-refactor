import { HEALTH_GAPS, type SystemHealth } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedGames, tempLibrary } from './testing.ts';

let library: Awaited<ReturnType<typeof tempLibrary>>;
beforeEach(async () => {
  library = await tempLibrary();
});
afterEach(async () => {
  await library.cleanup();
});

function lacking(counts: Partial<SystemHealth['lacking']>): SystemHealth['lacking'] {
  return {
    ...(Object.fromEntries(HEALTH_GAPS.map((gap) => [gap, 0])) as SystemHealth['lacking']),
    ...counts,
  };
}

function media(gameId: number, kinds: string[]) {
  const insert = library.db.$client.prepare(
    "insert into game_media (game_id, kind, path, size, version) values (?, ?, 'C:\\x.png', 1, 1)",
  );
  for (const kind of kinds) insert.run(gameId, kind);
}

function details(gameId: number, values: Record<string, string>) {
  for (const [column, value] of Object.entries(values)) {
    library.db.$client
      .prepare(`update game_metadata set ${column} = ? where game_id = ?`)
      .run(value, gameId);
  }
}

describe('LibraryRepository.systemHealth (system health)', () => {
  it('counts per system the games lacking their ROM, each art kind and each detail', () => {
    const [complete = 0, bare = 0] = seedGames(library.db, 'gce-vectrex', [
      { title: 'Armor Attack', year: 1982, genre: 'Shooter', players: '1-2' },
      { title: 'Bare Game', missing: true },
    ]);
    media(complete, ['box-front', 'screenshot-game-play', 'logo-clear']);
    details(complete, { developer: 'GCE', publisher: 'GCE', description: 'Tanks.' });
    // A blank detail counts as lacking.
    details(bare, { developer: '   ' });
    seedGames(library.db, 'snes', [{ title: 'Full', year: 1991 }]);

    const vectrex = library.repo.systemHealth().find((s) => s.systemId === 'gce-vectrex');
    expect(vectrex).toEqual({
      systemId: 'gce-vectrex',
      games: 2,
      lacking: lacking({
        rom: 1,
        ...Object.fromEntries(
          HEALTH_GAPS.filter((gap) => gap.startsWith('art:')).map((gap) => [gap, 2]),
        ),
        'art:box-front': 1,
        'art:screenshot-game-play': 1,
        'art:logo-clear': 1,
        'field:year': 1,
        'field:genre': 1,
        'field:developer': 1,
        'field:publisher': 1,
        'field:players': 1,
        'field:description': 1,
      }),
    });
  });

  it('leaves out hidden games, collection-only games and systems without games', () => {
    seedGames(library.db, 'gce-vectrex', ['Shown', { title: 'Secret', hidden: true }]);
    const [onlyInCollection] = seedGames(library.db, 'snes', ['Collection Only']);
    library.db.$client
      .prepare('update games set collection_only = 1 where id = ?')
      .run(onlyInCollection);
    expect(library.repo.systemHealth().map((s) => [s.systemId, s.games])).toEqual([
      ['gce-vectrex', 1],
    ]);
  });
});
