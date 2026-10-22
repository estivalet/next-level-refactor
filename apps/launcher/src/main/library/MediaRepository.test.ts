import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { MediaRepository } from './MediaRepository.ts';
import { games } from './schema.ts';
import { seedGames, tempLibrary } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup() {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const [a, b] = seedGames(library.db, 'snes', ['Alpha', 'Beta']);
  const [c] = seedGames(library.db, 'n64', ['Gamma']);
  if (!a || !b || !c) throw new Error('seed');
  return { library, media: new MediaRepository(library.db), a, b, c };
}

describe('MediaRepository', () => {
  it('FR-THM-2: replaceForSystem swaps one system and reports a change', async () => {
    const { media, a, b, c } = await setup();
    expect(
      media.replaceForSystem('n64', [{ gameId: c, kind: 'box-front', path: 'C:\\c.png', size: 1 }]),
    ).toBe(true);
    expect(
      media.replaceForSystem('snes', [
        { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1 },
        { gameId: a, kind: 'video', path: 'C:\\a.mp4', size: 2 },
        { gameId: b, kind: 'fanart', path: 'C:\\b.jpg', size: 3 },
      ]),
    ).toBe(true);
    expect(
      media.replaceForSystem('snes', [{ gameId: a, kind: 'video', path: 'C:\\a.mp4', size: 2 }]),
    ).toBe(true);
    const kinds = media.kindsByGame([a, b, c]);
    expect(kinds.get(a)).toEqual(['video']);
    expect(kinds.get(b)).toBeUndefined();
    expect(kinds.get(c)).toEqual(['box-front']);
    expect(media.path(a, 'video')).toBe('C:\\a.mp4');
    expect(media.path(a, 'box-front')).toBeNull();
  });

  it('FR-THM-2: the same rows again are not a change', async () => {
    const { media, a } = await setup();
    const row = { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1 };
    media.replaceForSystem('snes', [row]);
    expect(media.replaceForSystem('snes', [row])).toBe(false);
    expect(media.replaceForSystem('snes', [{ ...row, size: 5 }])).toBe(true);
  });

  it('FR-THM-2: deleting a game deletes its media', async () => {
    const { library, media, a } = await setup();
    media.replaceForSystem('snes', [{ gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1 }]);
    library.db.delete(games).where(eq(games.id, a)).run();
    expect(media.path(a, 'box-front')).toBeNull();
  });
});
