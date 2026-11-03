import { describe, expect, it } from 'vitest';
import { perfBudget } from '../library/testing.ts';
import { normalizeTitle } from '../scraper/screenscraper/titles.ts';
import { matchGames } from './match.ts';

const WORDS = [
  'super',
  'mega',
  'dragon',
  'quest',
  'racer',
  'fighter',
  'star',
  'legend',
  'zone',
  'ninja',
];

describe('LaunchBox matching performance (FR-SCR-6)', () => {
  it('Review Focus 5: one search over a 50k-game platform stays in budget', () => {
    const names = Array.from({ length: 50_000 }, (_, i) => {
      const text = `${WORDS[i % 10] ?? ''} ${WORDS[(i * 7) % 10] ?? ''} ${WORDS[(i * 3) % 10] ?? ''} ${String(i)}`;
      return { id: i + 1, name: text, norm: normalizeTitle(text, { isTitle: true }) };
    });
    const target = 'Super Dragon Quest Racer';
    names[25_000] = { id: 25_001, name: target, norm: normalizeTitle(target, { isTitle: true }) };
    const started = performance.now();
    const found = matchGames(names, { title: 'Super Dragon Quest Racer', fileName: 'x.zip' });
    expect(found[0]).toMatchObject({ id: 25_001, similarity: 100 });
    expect(performance.now() - started).toBeLessThanOrEqual(perfBudget(300));
  });
});
