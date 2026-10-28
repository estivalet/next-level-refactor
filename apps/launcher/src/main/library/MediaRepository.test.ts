import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { mediaUrl } from '@nextlevel/shared';
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
      media.replaceForSystem('n64', [
        { gameId: c, kind: 'box-front', path: 'C:\\c.png', size: 1, version: 0 },
      ]),
    ).toBe(true);
    expect(
      media.replaceForSystem('snes', [
        { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1, version: 0 },
        { gameId: a, kind: 'video', path: 'C:\\a.mp4', size: 2, version: 0 },
        { gameId: b, kind: 'fanart', path: 'C:\\b.jpg', size: 3, version: 0 },
      ]),
    ).toBe(true);
    expect(
      media.replaceForSystem('snes', [
        { gameId: a, kind: 'video', path: 'C:\\a.mp4', size: 2, version: 0 },
      ]),
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
    const row = { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1, version: 0 };
    media.replaceForSystem('snes', [row]);
    expect(media.replaceForSystem('snes', [row])).toBe(false);
    expect(media.replaceForSystem('snes', [{ ...row, size: 5, version: 0 }])).toBe(true);
  });

  it('FR-SCR-5: a changed version alone is a change', async () => {
    const { media, a } = await setup();
    const row = { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1, version: 10 };
    media.replaceForSystem('snes', [row]);
    expect(media.replaceForSystem('snes', [{ ...row, version: 11 }])).toBe(true);
    expect(media.versionsByGame([a]).get(a)).toEqual({ 'box-front': 11 });
  });

  it('upsert replaces the row and the theme URL changes (FR-SCR-5)', async () => {
    const { media, a, b } = await setup();
    media.replaceForSystem('snes', [
      { gameId: a, kind: 'box-front', path: 'C:\\a.jpg', size: 1, version: 10 },
      { gameId: b, kind: 'box-front', path: 'C:\\b.png', size: 1, version: 10 },
    ]);
    const before = mediaUrl(a, 'box-front', media.versionsByGame([a]).get(a)?.['box-front']);
    media.upsert({ gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 7, version: 20 });
    media.upsert({ gameId: a, kind: 'logo-clear', path: 'C:\\a-logo.png', size: 3, version: 21 });
    expect(media.path(a, 'box-front')).toBe('C:\\a.png');
    expect(media.kindsByGame([a]).get(a)).toEqual(['box-front', 'logo-clear']);
    const versions = media.versionsByGame([a, b]);
    expect(versions.get(a)).toEqual({ 'box-front': 20, 'logo-clear': 21 });
    expect(versions.get(b)).toEqual({ 'box-front': 10 });
    expect(mediaUrl(a, 'box-front', versions.get(a)?.['box-front'])).not.toBe(before);
  });

  it('FR-THM-2: deleting a game deletes its media', async () => {
    const { library, media, a } = await setup();
    media.replaceForSystem('snes', [
      { gameId: a, kind: 'box-front', path: 'C:\\a.png', size: 1, version: 0 },
    ]);
    library.db.delete(games).where(eq(games.id, a)).run();
    expect(media.path(a, 'box-front')).toBeNull();
  });
  it('D50: a moved NextLevel folder moves media paths inside it, and only those', async () => {
    const { library, media, a, b, c } = await setup();
    media.upsert({
      gameId: a,
      kind: 'box-front',
      path: 'E:\\NextLevel\\media\\a.png',
      size: 1,
      version: 0,
    });
    media.upsert({
      gameId: b,
      kind: 'box-front',
      path: 'E:\\NextLevel2\\b.png',
      size: 1,
      version: 0,
    });
    media.upsert({ gameId: c, kind: 'box-front', path: 'D:\\art\\c.png', size: 1, version: 0 });
    expect(media.relocate('E:\\NextLevel', 'F:\\NextLevel')).toBe(1);
    const paths = library.db.$client
      .prepare('select path from game_media order by path')
      .pluck()
      .all();
    expect(paths).toEqual([
      'D:\\art\\c.png',
      'E:\\NextLevel2\\b.png',
      'F:\\NextLevel\\media\\a.png',
    ]);
  });
});
