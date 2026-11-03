import { z } from 'zod';
import { GAME_ART_KINDS } from '../frontend/schema.ts';

/**
 * System health (owner request 2026-11-02, from the old dashboard's checker): how complete each
 * system's games are, as a 0–100 score and an A–F grade. Hidden and collection-only games are
 * left out (main counts them that way).
 */

/** Art that counts toward the grade; every other kind is listed as a gap but never graded. */
export const HEALTH_ART_KINDS = ['box-front', 'screenshot-game-play', 'logo-clear'] as const;

/** Details that count toward the grade. */
export const HEALTH_FIELDS = [
  'year',
  'genre',
  'developer',
  'publisher',
  'players',
  'description',
] as const;

/** What a game can lack: its ROM file, an art kind or a detail. Also a Library narrowing. */
export const HEALTH_GAPS = [
  'rom',
  ...GAME_ART_KINDS.map((kind) => `art:${kind}` as const),
  ...HEALTH_FIELDS.map((field) => `field:${field}` as const),
] as const;

export type HealthGap = (typeof HEALTH_GAPS)[number];
export const HealthGapSchema = z.enum(HEALTH_GAPS);

const count = z.number().int().min(0);

/** A system with games, and how many of them lack each thing. */
export const SystemHealthSchema = z.object({
  systemId: z.string(),
  games: count,
  lacking: z.record(HealthGapSchema, count),
});

export type SystemHealth = z.output<typeof SystemHealthSchema>;

export const HEALTH_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;
export type HealthGrade = (typeof HEALTH_GRADES)[number];

export interface HealthScore {
  /** Shares 0–1: ROMs found, graded art present, details filled. */
  rom: number;
  art: number;
  details: number;
  /** The three shares averaged, 0–100. */
  score: number;
  grade: HealthGrade;
}

/** The score and grade (A ≥ 90, B ≥ 75, C ≥ 50, D ≥ 25, else F) of a system. */
export function healthScore(system: SystemHealth): HealthScore {
  const { games, lacking } = system;
  const share = (gap: HealthGap) => (games === 0 ? 1 : (games - lacking[gap]) / games);
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const rom = share('rom');
  const art = average(HEALTH_ART_KINDS.map((kind) => share(`art:${kind}`)));
  const details = average(HEALTH_FIELDS.map((field) => share(`field:${field}`)));
  const score = Math.round(average([rom, art, details]) * 100);
  const grade: HealthGrade =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 50 ? 'C' : score >= 25 ? 'D' : 'F';
  return { rom, art, details, score, grade };
}
