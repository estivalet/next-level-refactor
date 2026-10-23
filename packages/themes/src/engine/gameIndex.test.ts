import type { ThemeGame } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { gameById, gameIndexOf } from './gameIndex.ts';

const base = FIXTURE_GAMES[0] as ThemeGame;
const games: ThemeGame[] = Array.from({ length: 10_000 }, (_, i) => ({ ...base, id: i + 1 }));

describe('gameIndex (FR-THM-3, NFR-PERF)', () => {
  it('builds one id → index map per list and reuses it', () => {
    const first = gameIndexOf(games);
    for (let i = 0; i < 100; i += 1) expect(gameIndexOf(games)).toBe(first);
    expect(first.get(5000)).toBe(4999);
  });

  it('finds a game by id, or undefined', () => {
    expect(gameById(games, 42)?.id).toBe(42);
    expect(gameById(games, 99_999)).toBeUndefined();
    expect(gameById(games.slice(0, 2), 42)).toBeUndefined();
  });
});
