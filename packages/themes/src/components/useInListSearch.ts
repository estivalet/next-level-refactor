// Ported from NextLevelOS src/themes/components/useInListSearch.ts @ 3d530b7.
import type { ThemeGame } from '@nextlevel/shared';
import { useCallback, useMemo, useState } from 'react';

/** A title search over the games of a level (screen spec S5: in-list search). */
export function useInListSearch(games: readonly ThemeGame[]) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((wasOpen) => {
      if (wasOpen) setQuery('');
      return !wasOpen;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter((game) => game.title.toLowerCase().includes(q));
  }, [games, query]);

  return { query, setQuery, isOpen, open, close, toggle, filtered };
}
