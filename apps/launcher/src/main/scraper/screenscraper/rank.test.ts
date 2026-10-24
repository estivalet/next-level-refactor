import { describe, expect, it } from 'vitest';
import { rankCandidates, SEARCH_THRESHOLD } from './rank.ts';
import { normalizeTitle } from './titles.ts';
import type { SsGame } from './types.ts';

const game = (id: number, names: string[], region = 'us'): SsGame => ({
  id: String(id),
  noms: names.map((text) => ({ region: 'us', text })),
  regions: [{ nom: region }],
});

function rank(query: string, games: SsGame[], isTitle = true, threshold = SEARCH_THRESHOLD) {
  const normalized = normalizeTitle(query, { isTitle });
  return rankCandidates(games, {
    normalized,
    matched: normalized,
    region: null,
    threshold,
    isTitle,
  });
}

describe('rankCandidates (FR-SCR-1)', () => {
  it.each(['Dr. Gizmo', 'Turbo Rally Bros. 3', 'Blip-Blop / Zorbo'])(
    'title mode scores an exact title 100: %s',
    (title) => {
      const [best] = rank(title, [game(1, [title])]);
      expect(best).toMatchObject({ providerGameId: 1, name: title, similarity: 100 });
    },
  );

  it('filename mode keeps the region bonus (ported score 93.89)', () => {
    const normalized = normalizeTitle('Turbo Rally Bros. 3 (USA).nes');
    const [match] = rankCandidates([game(1, ['Turbo Rally Bros. 3'])], {
      normalized,
      matched: normalized,
      region: 'us',
      threshold: 0,
      isTitle: false,
    });
    expect(match?.similarity).toBe(93.89);
    expect(match?.regionMatch).toBe(true);
  });

  it('a wrong region costs 5 points', () => {
    const normalized = normalizeTitle('Orbit', { isTitle: true });
    const [match] = rankCandidates([game(1, ['Orbit'], 'japan')], {
      normalized,
      matched: normalized,
      region: 'us',
      threshold: 0,
      isTitle: true,
    });
    expect(match?.similarity).toBe(95);
    expect(match?.regionMatch).toBe(false);
  });

  it('keeps the best of several regional names', () => {
    const [match] = rank('Moon Patrol Kai', [game(4, ['Lunar Rangers', 'Moon Patrol Kai'])]);
    expect(match).toMatchObject({ name: 'Moon Patrol Kai', similarity: 100 });
  });

  it('a relaxed variant is scored against that variant too', () => {
    const normalized = normalizeTitle('Orbit Racer Special Edition', { isTitle: true });
    const [match] = rankCandidates([game(2, ['Orbit Racer'])], {
      normalized,
      matched: 'orbit racer',
      region: null,
      threshold: SEARCH_THRESHOLD,
      isTitle: true,
    });
    expect(match?.similarity).toBe(100);
  });

  it('drops candidates below the threshold, without names, ids or duplicates', () => {
    const matches = rank('Orbit Racer', [
      game(1, ['Orbit Racer']),
      game(1, ['Orbit Racer']),
      game(2, ['Completely Different Thing']),
      { id: 'x', noms: [{ text: 'Orbit Racer' }] },
      { id: '3' },
    ]);
    expect(matches.map((m) => m.providerGameId)).toEqual([1]);
  });

  it('sorts by similarity, then by region match', () => {
    const normalized = normalizeTitle('Orbit Racer', { isTitle: true });
    const matches = rankCandidates(
      [
        game(1, ['Orbit Racers'], 'japan'),
        game(2, ['Orbit Racer'], 'japan'),
        game(3, ['Orbit Racer']),
      ],
      { normalized, matched: normalized, region: 'us', threshold: 0, isTitle: true },
    );
    expect(matches.map((m) => m.providerGameId)).toEqual([3, 2, 1]);
  });
});
