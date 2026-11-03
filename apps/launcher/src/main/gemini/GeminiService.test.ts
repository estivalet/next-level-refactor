import { AppErrorException, defaultSettings, type GeminiAnswer } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRepository } from '../library/GameRepository.ts';
import { MediaRepository } from '../library/MediaRepository.ts';
import { ScrapeRepository } from '../library/ScrapeRepository.ts';
import { seedGames, tempLibrary } from '../library/testing.ts';
import { MediaWriter } from '../scraper/MediaWriter.ts';
import { AnswerStore } from './AnswerStore.ts';
import type { GeminiReply } from './GeminiClient.ts';
import { GeminiService } from './GeminiService.ts';
import type { PromptGame } from './prompt.ts';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const NOW = new Date('2026-11-03T12:00:00.000Z');

async function setup(reply: Partial<GeminiReply> & { items?: unknown[] } = {}) {
  const library = await tempLibrary();
  cleanups.push(library.cleanup);
  const [gameId = 0] = seedGames(library.db, 'coleco-telstar', [
    { title: 'Tennis', relPath: 'Tennis/tennis.bat' },
  ]);
  const settings = defaultSettings();
  const asked: Array<{ games: PromptGame[]; fields: string[]; language: string }> = [];
  const events: unknown[] = [];
  const service = new GeminiService({
    client: {
      ask: (games, fields, language) => {
        asked.push({ games, fields, language });
        return Promise.resolve({
          items: reply.items ?? [
            {
              gameId,
              title: { known: true, value: 'Telstar Tennis' },
              year: { known: true, value: 1976 },
              developer: { known: false, value: null },
              description: { known: true, value: 'A ball-and-paddle game.' },
            },
          ],
          sources: reply.sources ?? [],
          grounded: reply.grounded ?? false,
        });
      },
    },
    answers: new AnswerStore(library.db),
    games: new GameRepository(library.db, (row) => row.relPath),
    media: new MediaRepository(library.db),
    scrapes: new ScrapeRepository(library.db),
    writer: new MediaWriter({ toPng: (bytes) => bytes }),
    transaction: (fn) => {
      library.db.$client.transaction(fn)();
    },
    settings: () => settings,
    systemName: () => 'Coleco Telstar',
    emit: (...event) => {
      events.push(event);
    },
    clock: () => NOW,
  });
  const set = (sql: string) => library.db.$client.prepare(sql).run({ gameId });
  return { library, service, gameId, asked, settings, set, events };
}

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppErrorException) return error.error.code;
    throw error;
  }
  return 'resolved';
}

describe('GeminiService (FR-SCR-7)', () => {
  it('FR-SCR-7: asks only the empty, unlocked fields, with system, file and language', async () => {
    const { service, gameId, asked, set } = await setup();
    set(
      `update game_metadata set genre = 'Sports', locked_fields = '["publisher"]' where game_id = @gameId`,
    );
    const view = await service.ask(gameId);
    expect(asked[0]?.fields).toEqual(['description', 'year', 'developer', 'players']);
    expect(asked[0]?.games[0]).toMatchObject({
      gameId,
      system: 'Coleco Telstar',
      title: 'Tennis',
      file: 'tennis.bat',
      known: { genre: 'Sports' },
    });
    expect(asked[0]?.language).toBe('English');
    expect(view.fields.year).toEqual({ current: null, scraped: 1976, locked: false });
    expect(view.fields.developer).toEqual({ current: null, scraped: null, locked: false });
    expect(view.fields.title).toEqual({
      current: 'Tennis',
      scraped: 'Telstar Tennis',
      locked: false,
    });
    expect(view.answer.title).toBe('Telstar Tennis');
  });

  it('FR-SCR-7: allFields asks all six; a game with nothing empty asks all six too', async () => {
    const { service, gameId, asked, set } = await setup();
    await service.ask(gameId, true);
    expect(asked[0]?.fields).toHaveLength(6);
    set(`update game_metadata set description = 'd', year = 1976, developer = 'c', publisher = 'c',
      genre = 'g', players = '2' where game_id = @gameId`);
    await service.ask(gameId);
    expect(asked[1]?.fields).toHaveLength(6);
  });

  it('FR-SCR-7: the description language follows the scraper language priority, then the app', async () => {
    const { service, gameId, asked, settings } = await setup();
    settings.general.language = 'pt-BR';
    await service.ask(gameId);
    expect(asked[0]?.language).toBe('Brazilian Portuguese');
    settings.scraper.languagePriority = ['fr'];
    await service.ask(gameId);
    expect(asked[1]?.language).toBe('French');
  });

  it('FR-SCR-7: stored returns the saved answer without asking again', async () => {
    const { service, gameId, asked } = await setup();
    expect(service.stored(gameId)).toBeNull();
    await service.ask(gameId);
    expect(service.stored(gameId)?.fields.year?.scraped).toBe(1976);
    expect(asked).toHaveLength(1);
  });

  it('FR-SCR-7: apply writes the ticked fields as a Gemini scrape and clears the answer', async () => {
    const { service, gameId, set } = await setup();
    set(`update game_metadata set locked_fields = '["year"]' where game_id = @gameId`);
    await service.ask(gameId, true);
    const result = await service.apply(gameId, ['year', 'title']);
    expect(result.game.year).toBe(1976);
    expect(result.game.title).toBe('Telstar Tennis');
    expect(result.game.lockedFields).toContain('year');
    expect(result.game.scrape).toMatchObject({ provider: 'gemini', status: 'scraped' });
    expect(service.stored(gameId)).toBeNull();
    expect(await code(service.apply(gameId, ['year']))).toBe('GEMINI_NO_ANSWER');
  });

  it('FR-SCR-7: apply never writes a field Gemini did not know', async () => {
    const { service, gameId } = await setup();
    await service.ask(gameId);
    const result = await service.apply(gameId, ['developer', 'description']);
    expect(result.game.developer).toBeNull();
    expect(result.game.description).toBe('A ball-and-paddle game.');
  });

  it('FR-SCR-7: Review Focus 3 — auto writes only fields still empty now; stored shows the new value', async () => {
    const { service, gameId, set, library } = await setup();
    const answer: GeminiAnswer = {
      gameId,
      route: 'api',
      fields: { year: { known: true, value: 1991 }, description: { known: true, value: 'D.' } },
      title: 'Other',
      sources: [],
      grounded: false,
      askedAt: NOW.toISOString(),
    };
    set(`update game_metadata set year = 1990 where game_id = @gameId`);
    expect(await service.record(answer, 'review', ['year', 'description'])).toBe('review');
    expect(service.stored(gameId)?.fields.year).toEqual({
      current: 1990,
      scraped: 1991,
      locked: false,
    });
    expect(await service.record(answer, 'auto', ['year', 'description'])).toBe('applied');
    const game = new GameRepository(library.db, (row) => row.relPath).get(gameId);
    expect(game.year).toBe(1990);
    expect(game.description).toBe('D.');
    expect(game.title).toBe('Tennis');
  });

  it('FR-SCR-7: auto with grounding on and no sources goes to review; nothing known is notFound', async () => {
    const { service, gameId, library } = await setup();
    const base: GeminiAnswer = {
      gameId,
      route: 'api',
      fields: { year: { known: true, value: 1976 } },
      title: null,
      sources: [],
      grounded: true,
      askedAt: NOW.toISOString(),
    };
    expect(await service.record(base, 'auto', ['year'])).toBe('review');
    const scrapes = new ScrapeRepository(library.db);
    expect(scrapes.get(gameId)).toMatchObject({ provider: 'gemini', status: 'review' });
    expect(
      await service.record({ ...base, fields: { year: { known: false, value: null } } }, 'review', [
        'year',
      ]),
    ).toBe('notFound');
  });

  it('FR-SCR-7: a notFound answer keeps the earlier scrape status', async () => {
    const { service, gameId, library } = await setup();
    const scrapes = new ScrapeRepository(library.db);
    scrapes.set(gameId, {
      provider: 'screenscraper',
      status: 'scraped',
      providerGameId: 5,
      candidates: 1,
      error: null,
      scrapedAt: NOW.toISOString(),
    });
    await service.record(
      {
        gameId,
        route: 'web',
        fields: {},
        title: null,
        sources: [],
        grounded: false,
        askedAt: NOW.toISOString(),
      },
      'auto',
      ['year'],
    );
    expect(scrapes.get(gameId)?.provider).toBe('screenscraper');
  });

  it('FR-SCR-7: dismiss deletes the answer and clears a Gemini review', async () => {
    const { service, gameId, library } = await setup();
    await service.record(
      {
        gameId,
        route: 'api',
        fields: { year: { known: true, value: 1976 } },
        title: null,
        sources: [],
        grounded: false,
        askedAt: NOW.toISOString(),
      },
      'review',
      ['year'],
    );
    service.dismiss(gameId);
    expect(service.stored(gameId)).toBeNull();
    expect(new ScrapeRepository(library.db).get(gameId)).toBeNull();
  });
});
