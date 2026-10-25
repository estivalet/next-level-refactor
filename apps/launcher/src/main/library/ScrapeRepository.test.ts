import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRepository } from './GameRepository.ts';
import { ScrapeRepository } from './ScrapeRepository.ts';
import { games } from './schema.ts';
import { seedGames, tempLibrary } from './testing.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup() {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const [a = 0, b = 0] = seedGames(library.db, 'snes', ['Alpha', 'Beta']);
  return { library, scrapes: new ScrapeRepository(library.db), a, b };
}

const scraped = {
  status: 'scraped' as const,
  providerGameId: 321,
  candidates: 1,
  error: null,
  scrapedAt: '2026-10-25T10:00:00.000Z',
};

describe('ScrapeRepository', () => {
  it('FR-SCR-5: set stores a status and set again replaces it', async () => {
    const { scrapes, a, b } = await setup();
    expect(scrapes.get(a)).toBeNull();
    scrapes.set(a, scraped);
    expect(scrapes.get(a)).toEqual(scraped);
    const review = { ...scraped, status: 'review' as const, providerGameId: null, candidates: 3 };
    scrapes.set(a, review);
    expect(scrapes.get(a)).toEqual(review);
    expect(scrapes.get(b)).toBeNull();
  });

  it('FR-SCR-5: game details carry the scrape status', async () => {
    const { library, scrapes, a, b } = await setup();
    scrapes.set(a, scraped);
    const repo = new GameRepository(library.db, (row) => row.relPath);
    expect(repo.get(a).scrape).toEqual(scraped);
    expect(repo.get(b).scrape).toBeNull();
  });

  it('FR-SCR-5: deleting a game deletes its scrape status', async () => {
    const { library, scrapes, a } = await setup();
    scrapes.set(a, scraped);
    library.db.delete(games).where(eq(games.id, a)).run();
    expect(scrapes.get(a)).toBeNull();
  });
});
