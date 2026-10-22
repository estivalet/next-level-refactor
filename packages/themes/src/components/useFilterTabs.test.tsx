// Cases ported from NextLevelOS src/themes/components/useFilterTabs.test.tsx @ 3d530b7, on a
// FakeThemeHost (Nintendo → Super Nintendo with Official and Homebrew filters).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { useFilterLayout } from '../engine/useFilterLayout.ts';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { parseFiltersInMenu, useFilterTabs } from './useFilterTabs.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseFiltersInMenu (FR-THM-4)', () => {
  it('passes booleans through', () => {
    expect(parseFiltersInMenu(true, false)).toEqual({ value: true });
    expect(parseFiltersInMenu(false, true)).toEqual({ value: false });
  });

  it('takes the fallback silently when missing', () => {
    expect(parseFiltersInMenu(undefined, true)).toEqual({ value: true });
  });

  it('takes the fallback with a warning key on a wrong type', () => {
    expect(parseFiltersInMenu('no', true)).toEqual({
      value: true,
      warning: 'themes.settings.filtersInMenuInvalid',
    });
    expect(parseFiltersInMenu(1, false).value).toBe(false);
  });
});

/** A theme without the option (Big Box, Console Home…): filters are always menu entries. */
function MenuOnlyTheme() {
  const nav = useThemeNavigation();
  useFilterLayout(true);
  return <span data-testid="kind">{nav.currentLevel?.kind ?? ''}</span>;
}

function Harness({ filtersInMenu }: { filtersInMenu: boolean }) {
  const nav = useThemeNavigation();
  const filters = useFilterTabs({ filtersInMenu });
  const level = nav.currentLevel;
  return (
    <div>
      <span data-testid="depth">{nav.state.stack.length}</span>
      <span data-testid="kind">{level?.kind ?? ''}</span>
      <span data-testid="tabs">{(filters.tabs ?? []).map((tab) => tab.id).join(',')}</span>
      <span data-testid="default">{filters.defaultTabId ?? ''}</span>
      <span data-testid="as-games">{String(filters.filtersAsGames)}</span>
      <span data-testid="focus">{nav.state.focusIndex}</span>
      <button
        onClick={() => {
          nav.setFocus(1);
        }}
      >
        focus1
      </button>
      <button
        onClick={() => {
          nav.setFilterTab('homebrew');
        }}
      >
        tab-homebrew
      </button>
      <button
        onClick={() => {
          nav.enter(0);
        }}
      >
        plain
      </button>
      <button
        onClick={() => {
          filters.enterItem(0);
        }}
      >
        item
      </button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;

async function toNintendo(filtersInMenu: boolean) {
  const host = new FakeThemeHost();
  const view = render(
    <ThemeEngineProvider host={host} onExit={vi.fn()}>
      <Harness filtersInMenu={filtersInMenu} />
    </ThemeEngineProvider>,
  );
  await waitFor(() => {
    expect(text('depth')).toBe('1');
  });
  fireEvent.click(screen.getByText('plain'));
  await waitFor(() => {
    expect(text('depth')).toBe('2');
  });
  /** What a theme switch does: same engine, a new theme with the other layout. */
  return (next: boolean) => {
    view.rerender(
      <ThemeEngineProvider host={host} onExit={vi.fn()}>
        <Harness key={String(next)} filtersInMenu={next} />
      </ThemeEngineProvider>,
    );
  };
}

describe('useFilterTabs (FR-THM-1, FR-THM-4)', () => {
  it('filters as tabs: enterItem flattens, tabs are the filter set, counts take the games', async () => {
    await toNintendo(false);
    expect(text('as-games')).toBe('true');
    fireEvent.click(screen.getByText('item'));
    await waitFor(() => {
      expect(text('kind')).toBe('games');
    });
    expect(text('tabs')).toBe('filter:official,filter:homebrew,all,hidden');
    expect(text('default')).toBe('filter:official');
  });

  it('filters in the menu: enterItem opens the filter menu with the default tabs', async () => {
    await toNintendo(true);
    expect(text('as-games')).toBe('false');
    fireEvent.click(screen.getByText('item'));
    await waitFor(() => {
      expect(text('depth')).toBe('3');
    });
    expect(text('kind')).toBe('menu');
    expect(text('tabs')).toBe('');
    expect(text('default')).toBe('');
  });

  it('a switch to a tabs theme turns the filter menu into the game list on the focused filter', async () => {
    const switchTo = await toNintendo(true);
    fireEvent.click(screen.getByText('item'));
    await waitFor(() => {
      expect(text('depth')).toBe('3');
    });
    fireEvent.click(screen.getByText('focus1')); // Homebrew
    switchTo(false);
    await waitFor(() => {
      expect(text('kind')).toBe('games');
    });
    expect(text('depth')).toBe('3');
    expect(text('default')).toBe('filter:homebrew');
  });

  it('a switch to a filters-in-menu theme turns the game list into the filter menu on its tab', async () => {
    const switchTo = await toNintendo(false);
    fireEvent.click(screen.getByText('item'));
    await waitFor(() => {
      expect(text('kind')).toBe('games');
    });
    fireEvent.click(screen.getByText('tab-homebrew'));
    switchTo(true);
    await waitFor(() => {
      expect(text('kind')).toBe('menu');
    });
    expect(text('depth')).toBe('3');
    expect(text('focus')).toBe('1'); // Homebrew
  });

  it('a theme without the option rebuilds a tabbed game list as the filter menu', async () => {
    const host = new FakeThemeHost();
    const view = render(
      <ThemeEngineProvider host={host} onExit={vi.fn()}>
        <Harness filtersInMenu={false} />
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(text('depth')).toBe('1');
    });
    fireEvent.click(screen.getByText('plain'));
    await waitFor(() => {
      expect(text('depth')).toBe('2');
    });
    fireEvent.click(screen.getByText('item'));
    await waitFor(() => {
      expect(text('kind')).toBe('games');
    });
    view.rerender(
      <ThemeEngineProvider host={host} onExit={vi.fn()}>
        <MenuOnlyTheme />
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(text('kind')).toBe('menu');
    });
  });
});
