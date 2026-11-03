import { describe, expect, it } from 'vitest';
import { normalizeTitle } from '../scraper/screenscraper/titles.ts';
import { matchGames, similarityAtLeast } from './match.ts';
import { similarity } from '../scraper/screenscraper/titles.ts';

const name = (id: number, text: string) => ({
  id,
  name: text,
  norm: normalizeTitle(text, { isTitle: true }),
});

const NAMES = [
  name(438312, 'Dracula: Undead Awakening'),
  name(472523, 'Ace Driver Collection'),
  name(472523, 'Ace Driver Trilogy'),
  name(5, 'Ace Combat'),
];

describe('LaunchBox title matching (FR-SCR-6)', () => {
  it('Review Focus 3: punctuation and file tags do not lower the match', () => {
    const [best] = matchGames(NAMES, {
      title: 'Dracula - Undead Awakening (USA)',
      fileName: 'Dracula - Undead Awakening (USA).nds',
    });
    expect(best).toMatchObject({ id: 438312, name: 'Dracula: Undead Awakening' });
    expect(best?.similarity).toBeGreaterThanOrEqual(90);
  });

  it('an alternate name finds its game once, with the best name', () => {
    const found = matchGames(NAMES, { title: 'Ace Driver Trilogy', fileName: 'x.iso' });
    expect(found.filter((match) => match.id === 472523)).toEqual([
      { id: 472523, name: 'Ace Driver Trilogy', similarity: 100 },
    ]);
  });

  it('nothing at 60 or more answers none', () => {
    expect(matchGames(NAMES, { title: 'Zelda', fileName: 'Zelda.nes' })).toEqual([]);
  });

  it('the early-exit score equals titles.ts similarity whenever it reaches the threshold', () => {
    const pairs = [
      ['ace driver collection', 'ace driver trilogy'],
      ['dracula undead awakening', 'dracula undead awakenin'],
      ['super mario bros', 'super mario bros 3'],
      ['zelda', 'ace combat'],
    ] as const;
    for (const [a, b] of pairs) {
      const full = similarity(a, b);
      expect(similarityAtLeast(a, b, 60)).toBeCloseTo(full >= 60 ? full : 0, 6);
    }
  });
});
