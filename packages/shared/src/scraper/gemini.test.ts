import { describe, expect, it } from 'vitest';
import { geminiContract } from '../ipc/geminiContract.ts';
import { SettingsSchema } from '../settings/schema.ts';
import {
  GEMINI_DEFAULT_MODEL,
  GEMINI_FIELDS,
  GeminiAnswerSchema,
  GeminiBatchRulesSchema,
  GeminiSourceSchema,
  GeminiWebRequestSchema,
  GeminiWebResultLineSchema,
} from './gemini.ts';
import { ScrapeProviderSchema } from './schema.ts';

describe('Gemini fill contracts (FR-SCR-7)', () => {
  it('FR-SCR-7: Gemini settings default to the free model, grounding on, no web tool paths', () => {
    const settings = SettingsSchema.parse({ schemaVersion: 2 });
    expect(settings.scraper.gemini).toEqual({
      model: GEMINI_DEFAULT_MODEL,
      grounding: true,
      webTool: { python: '', firefoxProfile: '', driver: '' },
    });
  });

  it('FR-SCR-7: Gemini fills six fields; never rating or title in a batch', () => {
    expect(GEMINI_FIELDS).toEqual([
      'description',
      'year',
      'developer',
      'publisher',
      'genre',
      'players',
    ]);
    const rules = (fields: unknown) =>
      GeminiBatchRulesSchema.safeParse({ fields, mode: 'review', route: 'api' }).success;
    expect(rules(['year'])).toBe(true);
    expect(rules([])).toBe(false);
    expect(rules(['rating'])).toBe(false);
    expect(rules(['title'])).toBe(false);
    expect(
      GeminiBatchRulesSchema.safeParse({ fields: ['year'], mode: 'often', route: 'api' }).success,
    ).toBe(false);
  });

  it('FR-SCR-7: a source link must be https', () => {
    const source = (url: string) => GeminiSourceSchema.safeParse({ title: 'Wiki', url }).success;
    expect(source('https://en.wikipedia.org/wiki/Pong')).toBe(true);
    expect(source('http://example.com')).toBe(false);
    expect(source('javascript:alert(1)')).toBe(false);
  });

  it('FR-SCR-7: gemini is a scrape provider', () => {
    expect(ScrapeProviderSchema.parse('gemini')).toBe('gemini');
  });

  it('FR-SCR-7: an answer keeps unknown fields as known:false with no value', () => {
    const answer = {
      gameId: 1,
      route: 'api',
      fields: { year: { known: true, value: 1991 }, developer: { known: false, value: null } },
      title: null,
      sources: [],
      askedAt: '2026-11-03T12:00:00.000Z',
    };
    expect(GeminiAnswerSchema.safeParse(answer).success).toBe(true);
    expect(
      GeminiAnswerSchema.safeParse({ ...answer, fields: { rating: { known: true, value: 4 } } })
        .success,
    ).toBe(false);
  });

  it('FR-SCR-7: the Gemini contract has its channels; apply may name the title, not rating', () => {
    for (const channel of [
      'gemini.key.status',
      'gemini.key.set',
      'gemini.test',
      'gemini.ask',
      'gemini.stored',
      'gemini.apply',
      'gemini.dismiss',
    ]) {
      expect(geminiContract).toHaveProperty([channel]);
    }
    const apply = geminiContract['gemini.apply'].input;
    expect(apply.safeParse({ gameId: 1, fields: ['title', 'year'] }).success).toBe(true);
    expect(apply.safeParse({ gameId: 1, fields: ['rating'] }).success).toBe(false);
  });

  it('FR-SCR-7: the web tool files carry games and raw replies, never a key', () => {
    const request = {
      jobId: 3,
      fields: ['year'],
      language: 'English',
      games: [{ gameId: 1, system: 'Coleco Telstar', title: 'Tennis', file: 'tennis', known: {} }],
    };
    expect(GeminiWebRequestSchema.safeParse(request).success).toBe(true);
    expect(GeminiWebRequestSchema.safeParse({ ...request, apiKey: 'x' }).success).toBe(false);
    expect(
      GeminiWebResultLineSchema.safeParse({ gameIds: [1], reply: '[{"gameId":1}]' }).success,
    ).toBe(true);
  });
});
