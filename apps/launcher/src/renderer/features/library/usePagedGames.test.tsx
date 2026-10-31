import { ok, type GameListQuery, type GameRow } from '@nextlevel/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { createQueryClient } from '../../queryClient.ts';
import { installFakeBridge } from '../../test-utils.tsx';
import { usePagedGames } from './usePagedGames.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const TOTAL = 10_000;
const row = (index: number): GameRow => ({
  id: index + 1,
  systemId: 'nintendo-64',
  title: `Game ${String(index)}`,
  year: null,
  genre: null,
  players: null,
  favorite: false,
  hidden: false,
  completed: false,
  userRating: null,
  missing: false,
  expectedPath: null,
  boxArt: null,
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

describe('usePagedGames', () => {
  it('NFR-PERF-2: a scrolled list fetches only the first page and the pages in view', async () => {
    const bridge = installFakeBridge({
      'library.games.list': (query: GameListQuery) => {
        const games: GameRow[] = [];
        for (let i = query.offset; i < Math.min(query.offset + query.limit, TOTAL); i += 1) {
          games.push(row(i));
        }
        return ok({ total: TOTAL, offset: query.offset, games });
      },
    });
    const query = {
      scope: { kind: 'system' as const, systemId: 'nintendo-64' },
      tab: 'all' as const,
    };
    const { result } = renderHook(() => usePagedGames(query, { first: 9990, last: 9999 }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.rowAt(9995)?.title).toBe('Game 9995');
    });
    expect(result.current.total).toBe(TOTAL);
    expect(result.current.rowAt(500)).toBeUndefined();
    const offsets = bridge.calls
      .filter((call) => call.channel === 'library.games.list')
      .map((call) => (call.input as GameListQuery).offset)
      .sort((a, b) => a - b);
    expect(offsets).toEqual([0, 9800]);
  });
});
