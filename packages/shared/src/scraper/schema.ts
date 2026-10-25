import { z } from 'zod';
import { GAME_ART_KINDS } from '../frontend/schema.ts';

// Scraping contracts (FR-SCR-1..5, plan M6). Provider ids are ScreenScraper's integers.

export const GameArtKindSchema = z.enum(GAME_ART_KINDS);

/** Metadata a scrape can fill; `title` only in the single-game dialog (D19). */
export const SCRAPE_FIELDS = [
  'title',
  'description',
  'year',
  'developer',
  'publisher',
  'genre',
  'players',
  'rating',
] as const;

export type ScrapeField = (typeof SCRAPE_FIELDS)[number];

export const ScrapeFieldSchema = z.enum(SCRAPE_FIELDS);

/** Settings → Scraper (data model §2): priorities and the batch defaults. */
export const ScraperSettingsSchema = z.object({
  regionPriority: z
    .array(z.string().regex(/^[a-z]{2,4}$/))
    .min(1)
    .max(10)
    .default(['us', 'eu', 'wor', 'jp']),
  /** Empty = the app language, then English, then any. */
  languagePriority: z
    .array(z.string().regex(/^[a-z]{2}$/))
    .max(10)
    .default([]),
  artKinds: z
    .array(GameArtKindSchema)
    .default(['box-front', 'logo-clear', 'screenshot-game-play', 'fanart']),
  fields: z
    .array(ScrapeFieldSchema)
    .default(['description', 'year', 'developer', 'publisher', 'genre', 'players', 'rating']),
});

export type ScraperSettings = z.output<typeof ScraperSettingsSchema>;

const providerGameId = z.number().int().positive();

export const ScrapeCandidateSchema = z.object({
  providerGameId,
  name: z.string(),
  year: z.string().nullable(),
  region: z.string().nullable(),
  similarity: z.number().min(0).max(100),
  /** `nextlevel://scrape-thumb/<id>`; ScreenScraper URLs carry credentials and never leave main. */
  thumb: z.string().nullable(),
});

export type ScrapeCandidate = z.output<typeof ScrapeCandidateSchema>;

export const ScrapeSearchResultSchema = z.object({
  method: z.enum(['hash', 'title']),
  candidates: z.array(ScrapeCandidateSchema),
});

export type ScrapeSearchResult = z.output<typeof ScrapeSearchResultSchema>;

const fieldValue = z.union([z.string(), z.number()]).nullable();

export const ScrapePreviewSchema = z.object({
  art: z.record(GameArtKindSchema, z.object({ local: z.boolean(), available: z.boolean() })),
  fields: z.record(
    ScrapeFieldSchema,
    z.object({ current: fieldValue, scraped: fieldValue, locked: z.boolean() }),
  ),
});

export type ScrapePreview = z.output<typeof ScrapePreviewSchema>;

export const ScrapeStatusSchema = z.object({
  status: z.enum(['scraped', 'review', 'notFound', 'failed']),
  providerGameId: providerGameId.nullable(),
  candidates: z.number().int().min(0),
  error: z.string().nullable(),
  scrapedAt: z.string(),
});

export type ScrapeStatus = z.output<typeof ScrapeStatusSchema>;

/** Which credentials the store holds; never the values (FR-SCR-3). */
export const CredentialStatusSchema = z.object({
  /** False when the OS store can't encrypt (Electron `safeStorage`). */
  available: z.boolean(),
  devId: z.boolean(),
  devPassword: z.boolean(),
  user: z.boolean(),
  password: z.boolean(),
});

export type CredentialStatus = z.output<typeof CredentialStatusSchema>;

/** Settings → Scraper → Test: the signed-in account and today's quota (US-D6). */
export const ScraperAccountSchema = z.object({
  user: z.string().nullable(),
  requestsToday: z.number().int().min(0).nullable(),
  maxRequestsPerDay: z.number().int().positive().nullable(),
});

export type ScraperAccount = z.output<typeof ScraperAccountSchema>;
