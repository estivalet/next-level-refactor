import { z } from 'zod';
import { SYSTEM_KINDS } from '../catalog/schema.ts';

const text = (max: number) => z.string().trim().min(1).max(max).optional();
const year = () => z.number().int().min(1900).max(2100).optional();
const httpUrl = () => z.url({ protocol: /^https?$/ }).optional();

/** A hardware model or revision of a system (FR-MUS-1). */
export const SystemInfoModelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  releaseYear: year(),
  launchPrice: text(60),
  cpu: text(200),
  ram: text(200),
  notes: text(4000),
  imageUrl: httpUrl(),
});

/** A curated top game: a title, optionally pinned to a library game (FR-MUS-3). */
export const SystemInfoTopGameSchema = z.object({
  title: z.string().trim().min(1).max(200),
  year: year(),
  gameId: z.number().int().positive().optional(),
});

/** Where an entry's facts came from (FR-MUS-5). */
export const SystemInfoSourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: httpUrl(),
});

/** A system's museum entry (FR-MUS-1). */
export const SystemInfoSchema = z.object({
  systemId: z.string().min(1).max(100),
  fullName: text(200),
  manufacturer: text(200),
  country: text(80),
  releaseYear: year(),
  discontinuedYear: year(),
  generation: text(40),
  unitsSold: text(80),
  description: text(20000),
  history: text(20000),
  legacy: text(20000),
  cpu: text(300),
  ram: text(300),
  graphics: text(300),
  sound: text(300),
  media: text(300),
  display: text(300),
  models: z.array(SystemInfoModelSchema).max(100).default([]),
  predecessor: text(200),
  successor: text(200),
  peripherals: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  topGames: z.array(SystemInfoTopGameSchema).max(100).default([]),
  sources: z.array(SystemInfoSourceSchema).max(20).default([]),
});

/** The shipped seed file: entries plus a note on where they came from. */
export const SystemInfoSeedFileSchema = z.object({
  source: z.string(),
  entries: z.array(SystemInfoSchema),
});

/** One row of the Museum app's system list (FR-MUS-2). */
export const SystemInfoSummarySchema = z.object({
  systemId: z.string(),
  name: z.string(),
  kind: z.enum(SYSTEM_KINDS),
  manufacturer: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  edited: z.boolean(),
});

/** Top game as the theme page sees it. */
export const ResolvedTopGameSchema = SystemInfoTopGameSchema.extend({
  owned: z.object({ gameId: z.number().int().positive() }).nullable(),
});

/** The entry a theme reads, with owned top games resolved (FR-MUS-4). */
export const ThemeSystemInfoSchema = SystemInfoSchema.omit({ topGames: true }).extend({
  topGames: z.array(ResolvedTopGameSchema),
});

export type SystemInfoSeedFile = z.output<typeof SystemInfoSeedFileSchema>;
export type SystemInfo = z.output<typeof SystemInfoSchema>;
export type SystemInfoModel = z.output<typeof SystemInfoModelSchema>;
export type SystemInfoTopGame = z.output<typeof SystemInfoTopGameSchema>;
export type SystemInfoSource = z.output<typeof SystemInfoSourceSchema>;
export type SystemInfoSummary = z.output<typeof SystemInfoSummarySchema>;
export type ResolvedTopGame = z.output<typeof ResolvedTopGameSchema>;
export type ThemeSystemInfo = z.output<typeof ThemeSystemInfoSchema>;

/** Lowercase, drop a trailing "(…)" / "[…]" tag group, strip punctuation, collapse spaces. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/(?:\s*[([][^)\]]*[)\]])+\s*$/u, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}
