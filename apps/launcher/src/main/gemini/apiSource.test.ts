import { describe, expect, it } from 'vitest';
import { apiSource } from './apiSource.ts';
import type { PromptGame } from './prompt.ts';

const game = (gameId: number): PromptGame => ({
  gameId,
  system: 'S',
  title: `T${String(gameId)}`,
  file: 'f',
  known: {},
});

describe('apiSource (FR-SCR-7)', () => {
  it('FR-SCR-7: keeps only asked ids, the first answer per id, and passes sources through', async () => {
    const source = apiSource({
      ask: () =>
        Promise.resolve({
          items: [
            { gameId: 1, year: { known: true, value: 1977 } },
            { gameId: 99, year: { known: true, value: 1999 } },
            { gameId: 1, year: { known: true, value: 1988 } },
            'junk',
            { gameId: '2' },
          ],
          sources: [{ title: 'W', url: 'https://w.example' }],
          grounded: true,
        }),
    });
    const reply = await source.next([game(1), game(2)], ['year'], 'English');
    expect([...reply.items.keys()]).toEqual([1]);
    expect(reply.items.get(1)).toEqual({ gameId: 1, year: { known: true, value: 1977 } });
    expect(reply.sources).toHaveLength(1);
    expect(reply.grounded).toBe(true);
  });
});
