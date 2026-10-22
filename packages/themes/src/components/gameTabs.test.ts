// Cases ported from NextLevelOS src/themes/components/gameTabs.test.ts and useInListSearch.test.ts
// @ 3d530b7: tabs are All · Favorites · Hidden (screen spec S5; no Installed tab), filters are
// menu nodes and games carry real flags.
import type { MenuNode, ThemeGame } from '@nextlevel/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { buildFilterTabs, countTabs, DEFAULT_GAME_TABS, tabLabel } from './gameTabs.ts';
import { useInListSearch } from './useInListSearch.ts';

const base = FIXTURE_GAMES[0] as ThemeGame;
const game = (id: number, over: Partial<ThemeGame> = {}): ThemeGame => ({
  ...base,
  id,
  title: `Game ${String(id)}`,
  ...over,
});

const games = [
  game(1, { favorite: true, filters: ['official'] }),
  game(2, { filters: ['homebrew'] }),
  game(3, { favorite: true, hidden: true, filters: ['official'] }),
  game(4, { filters: [] }),
];

const t = (key: string) => `t:${key}`;

const ids = (tabId: string, tabs = DEFAULT_GAME_TABS) =>
  games.filter((g) => tabs.find((tab) => tab.id === tabId)?.predicate(g)).map((g) => g.id);

describe('DEFAULT_GAME_TABS (FR-THM-1)', () => {
  it('has All, Favorites, Hidden in order, labelled through i18n', () => {
    expect(DEFAULT_GAME_TABS.map((tab) => tabLabel(tab, t))).toEqual([
      't:themes.tabs.all',
      't:themes.tabs.favorites',
      't:themes.tabs.hidden',
    ]);
  });

  it('excludes hidden games from every tab except Hidden', () => {
    expect(ids('all')).toEqual([1, 2, 4]);
    expect(ids('favorites')).toEqual([1]);
    expect(ids('hidden')).toEqual([3]);
  });

  it('countTabs counts per tab id', () => {
    expect(countTabs(games, DEFAULT_GAME_TABS)).toEqual({ all: 3, favorites: 1, hidden: 1 });
  });
});

const filterNode = (slug: string, display: string): MenuNode => ({
  id: `s:snes:f:${slug}`,
  name: 'Super Nintendo',
  display,
  type: 'filter',
  systemId: 'snes',
  filter: slug,
  children: [],
});

describe('buildFilterTabs (FR-THM-1)', () => {
  it('Official first, the rest in order, then All and Hidden; opens on Official', () => {
    const { tabs, defaultTabId } = buildFilterTabs([
      filterNode('homebrew', 'Homebrew'),
      filterNode('official', 'Official'),
      filterNode('hack', 'Hacks'),
    ]);
    expect(tabs.map((tab) => tab.id)).toEqual([
      'filter:official',
      'filter:homebrew',
      'filter:hack',
      'all',
      'hidden',
    ]);
    expect(tabs.map((tab) => tabLabel(tab, t))).toEqual([
      'Official',
      'Homebrew',
      'Hacks',
      't:themes.tabs.all',
      't:themes.tabs.hidden',
    ]);
    expect(defaultTabId).toBe('filter:official');
  });

  it('opens on All without an Official filter', () => {
    const { defaultTabId } = buildFilterTabs([filterNode('hack', 'Hacks')]);
    expect(defaultTabId).toBe('all');
  });

  it('a filter tab holds the non-hidden games with that filter', () => {
    const { tabs } = buildFilterTabs([filterNode('official', 'Official')]);
    expect(ids('filter:official', tabs)).toEqual([1]);
  });

  it('a filter listed twice gives one tab', () => {
    const { tabs } = buildFilterTabs([
      filterNode('official', 'Official'),
      filterNode('official', 'Official 2'),
    ]);
    expect(tabs.map((tab) => tab.id)).toEqual(['filter:official', 'all', 'hidden']);
  });
});

describe('useInListSearch (FR-THM-1)', () => {
  const list = [
    game(1, { title: 'Pitfall' }),
    game(2, { title: 'River Raid' }),
    game(3, { title: 'Pitfall II' }),
  ];

  it('filters by case-insensitive title substring', () => {
    const { result } = renderHook(() => useInListSearch(list));
    act(() => {
      result.current.setQuery('pitfall');
    });
    expect(result.current.filtered).toHaveLength(2);
  });

  it('an empty query returns all', () => {
    const { result } = renderHook(() => useInListSearch(list));
    expect(result.current.filtered).toHaveLength(3);
  });

  it('close clears the query', () => {
    const { result } = renderHook(() => useInListSearch(list));
    act(() => {
      result.current.open();
      result.current.setQuery('x');
      result.current.close();
    });
    expect(result.current.query).toBe('');
    expect(result.current.isOpen).toBe(false);
  });
});
