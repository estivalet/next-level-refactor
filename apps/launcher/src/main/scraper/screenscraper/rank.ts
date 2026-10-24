// Candidate scoring, ported from NextLevelOS scrappers/ScreenScraper.py (_rank_candidates and the
// sort in search_games) @ 3d530b7.
import { candidateRegion, gameNames } from './metadata.ts';
import { normalizeTitle, similarity } from './titles.ts';
import { positiveInt, type SsGame } from './types.ts';

/** The single-game dialog lists candidates from this score up (as NextLevelOS). */
export const SEARCH_THRESHOLD = 60;

export interface GameMatch {
  providerGameId: number;
  name: string;
  /** 0–100, two decimals. */
  similarity: number;
  /** null when the query or the game has no region. */
  regionMatch: boolean | null;
  game: SsGame;
}

export interface RankQuery {
  /** The full normalized query. */
  normalized: string;
  /** The (possibly relaxed) variant that found these games. */
  matched: string;
  /** Region from the file name's tags, or null. */
  region: string | null;
  threshold: number;
  isTitle: boolean;
}

/**
 * Scores each game by its best-matching name against the query and the variant that found it,
 * ±5 for a region match/mismatch; keeps those at or above the threshold, one per game id, best
 * first (ties: region match first).
 */
export function rankCandidates(games: readonly SsGame[], query: RankQuery): GameMatch[] {
  const matches: GameMatch[] = [];
  const seen = new Set<number>();
  for (const game of games) {
    const id = positiveInt(game.id);
    const names = gameNames(game);
    if (id === null || seen.has(id) || names.length === 0) continue;
    let score = 0;
    let name = names[0] ?? '';
    for (const candidate of names) {
      // A candidate is a game name, never a path: "Dr. Gizmo" keeps "gizmo" even when the query
      // came from a ROM file name (NextLevelOS cut it at the dot).
      const normalized = normalizeTitle(candidate, { isTitle: true });
      const value = Math.max(
        similarity(query.normalized, normalized),
        similarity(query.matched, normalized),
      );
      if (value > score) {
        score = value;
        name = candidate;
      }
    }
    const region = candidateRegion(game);
    const regionMatch = query.region !== null && region !== null ? query.region === region : null;
    if (regionMatch === true) score = Math.min(100, score + 5);
    if (regionMatch === false) score = Math.max(0, score - 5);
    if (score >= query.threshold) {
      seen.add(id);
      matches.push({
        providerGameId: id,
        name,
        similarity: Math.round(score * 100) / 100,
        regionMatch,
        game,
      });
    }
  }
  return matches.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      Number(b.regionMatch === true) - Number(a.regionMatch === true),
  );
}
