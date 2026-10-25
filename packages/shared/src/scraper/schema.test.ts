import { describe, expect, it } from 'vitest';
import { GAME_ART_KINDS } from '../frontend/schema.ts';
import {
  CredentialStatusSchema,
  SCRAPE_FIELDS,
  ScrapeCandidateSchema,
  ScrapePreviewSchema,
  ScraperSettingsSchema,
} from './schema.ts';

describe('scraper contracts', () => {
  it('FR-SCR-2: batch defaults leave the title out (D19)', () => {
    expect(ScraperSettingsSchema.parse({}).fields).not.toContain('title');
  });

  it('FR-SCR-1: a candidate similarity stays within 0–100', () => {
    const candidate = {
      providerGameId: 7,
      name: 'Invented Quest',
      year: '1994',
      region: 'us',
      similarity: 101,
      thumb: null,
    };
    expect(ScrapeCandidateSchema.safeParse(candidate).success).toBe(false);
    expect(ScrapeCandidateSchema.safeParse({ ...candidate, similarity: 100 }).success).toBe(true);
  });

  it('D16: a preview lists every art kind and field, and no old kind', () => {
    const art = Object.fromEntries(
      GAME_ART_KINDS.map((kind) => [kind, { local: false, available: true }]),
    );
    const fields = Object.fromEntries(
      SCRAPE_FIELDS.map((field) => [field, { current: null, scraped: 'x', locked: false }]),
    );
    expect(ScrapePreviewSchema.safeParse({ art, fields }).success).toBe(true);
    const old = { ...art, 'screenshot-select': { local: false, available: true } };
    expect(ScrapePreviewSchema.safeParse({ art: old, fields }).success).toBe(false);
    const partial = Object.fromEntries(Object.entries(art).filter(([kind]) => kind !== 'marquee'));
    expect(ScrapePreviewSchema.safeParse({ art: partial, fields }).success).toBe(false);
  });

  it('FR-SCR-3: credential status carries flags only', () => {
    const status = CredentialStatusSchema.parse({
      available: true,
      devId: true,
      devPassword: true,
      user: false,
      password: false,
      secret: 'x',
    });
    expect(Object.values(status).every((v) => typeof v === 'boolean')).toBe(true);
  });
});
