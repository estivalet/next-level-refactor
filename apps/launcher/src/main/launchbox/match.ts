import { SEARCH_THRESHOLD } from '../scraper/screenscraper/rank.ts';
import { normalizeTitle, queryVariants } from '../scraper/screenscraper/titles.ts';
import type { LbName } from './LaunchBoxIndex.ts';

export interface LbMatch {
  id: number;
  name: string;
  /** 0–100, two decimals. */
  similarity: number;
}

const MAX_MATCHES = 20;

let previousRow = new Int32Array(64);
let currentRow = new Int32Array(64);

/**
 * `similarity()` from titles.ts (100 minus the edit distance as a share of the longer string),
 * but it gives up with 0 as soon as the score can no longer reach `threshold`: most of a
 * 50k-game platform is rejected after a few characters (Review Focus 5).
 */
export function similarityAtLeast(a: string, b: string, threshold: number): number {
  if (a === b) return 100;
  const longest = Math.max(a.length, b.length);
  if (longest === 0 || a.length === 0 || b.length === 0) return 0;
  const maxDistance = Math.floor(longest * (1 - threshold / 100) + 1e-9);
  if (Math.abs(a.length - b.length) > maxDistance) return 0;
  if (previousRow.length <= b.length) {
    previousRow = new Int32Array(b.length + 1);
    currentRow = new Int32Array(b.length + 1);
  }
  for (let j = 0; j <= b.length; j++) previousRow[j] = j;
  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;
    let rowMin = i;
    const char = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = char === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(
        (currentRow[j - 1] ?? 0) + 1,
        (previousRow[j] ?? 0) + 1,
        (previousRow[j - 1] ?? 0) + cost,
      );
      currentRow[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxDistance) return 0;
    [previousRow, currentRow] = [currentRow, previousRow];
  }
  const distance = previousRow[b.length] ?? longest;
  return distance > maxDistance ? 0 : (1 - distance / longest) * 100;
}

/**
 * LaunchBox candidates for a game title, scored like ScreenScraper's ranker (normalized title and
 * its relaxed variants, the best name per game: an alternate name finds its game), ≥ 60, best
 * first, at most 20. LaunchBox names carry no region tags, so there is no region bonus.
 */
export function matchGames(
  names: readonly LbName[],
  query: { title: string; fileName: string },
): LbMatch[] {
  const normalized =
    normalizeTitle(query.title, { isTitle: true }) || normalizeTitle(query.fileName);
  if (!normalized) return [];
  const variants = queryVariants(normalized);
  const best = new Map<number, LbMatch>();
  for (const candidate of names) {
    let score = 0;
    for (const variant of variants) {
      score = Math.max(score, similarityAtLeast(variant, candidate.norm, SEARCH_THRESHOLD));
      if (score === 100) break;
    }
    if (score < SEARCH_THRESHOLD) continue;
    const rounded = Math.round(score * 100) / 100;
    const previous = best.get(candidate.id);
    if (!previous || rounded > previous.similarity) {
      best.set(candidate.id, { id: candidate.id, name: candidate.name, similarity: rounded });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.similarity - a.similarity || a.name.localeCompare(b.name))
    .slice(0, MAX_MATCHES);
}
