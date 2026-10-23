import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../queryClient.ts';
import { useCollectionDrag } from './useCollectionDrag.ts';
import type { LibraryView } from './useLibraryView.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe('useCollectionDrag (FR-LIB-8)', () => {
  it('a drag from a selected row moves every selected game, loaded or not', () => {
    const view = {
      selection: { anchor: 0, ids: new Set([2, 3, 900]) },
      games: { rowAt: (index: number) => (index === 1 ? { id: 3 } : undefined) },
      // Only the loaded pages: game 900 sits on a page never fetched.
      selectedGames: () => [{ id: 2 }, { id: 3 }],
    } as unknown as LibraryView;
    const collection = { id: 1, name: 'Picks', sort: 'manual' as const, games: 1000 };
    const { result } = renderHook(() => useCollectionDrag(view, collection), { wrapper });
    expect(result.current?.blockFor(1).sort((a, b) => a - b)).toEqual([2, 3, 900]);
  });
});
