// Cases ported from NextLevelOS src/themes/showcase/ShowcaseTheme.test.tsx @ 3d530b7 on a
// FakeThemeHost (Nintendo · Sega · Collections · Computers), driven by input actions (US-C1).
import type { MenuNode, MenuTree, ThemeGame } from '@nextlevel/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSystemInfoCache } from '../engine/systemInfo.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES, FIXTURE_MENU } from '../host/fixtures.ts';
import { press, renderTheme } from '../themeTestUtils.tsx';
import { showcaseTheme } from './index.ts';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

const c64: MenuNode = {
  id: 's:c64',
  name: 'C64',
  display: 'C64',
  type: 'system',
  systemId: 'c64',
  children: [
    {
      id: 's:c64:f:hit',
      name: 'C64',
      display: 'Hit',
      type: 'filter',
      systemId: 'c64',
      filter: 'hit',
      children: [],
    },
  ],
};
const MENU: MenuTree = {
  ...FIXTURE_MENU,
  items: [
    ...FIXTURE_MENU.items,
    {
      id: 'm:computers',
      name: 'Computers',
      display: 'Computers',
      type: 'category',
      children: [c64],
    },
  ],
};
const C64_GAMES: ThemeGame[] = [
  {
    ...(FIXTURE_GAMES[0] as ThemeGame),
    id: 950,
    systemId: 'c64',
    title: 'Hit A',
    filters: ['hit'],
    media: ['box-front', 'video'],
  },
];
const ART = {
  packFiles: [],
  assetsFiles: ['logo/clear/Super Nintendo.png', 'system-info/Sega Genesis.json'],
  manifest: null,
  warnings: [],
};

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });
const stripTabs = () =>
  [...document.querySelectorAll('.sc-strip-head [role="tab"]')].map(
    (t) => t.firstChild?.textContent,
  );
const activeStripTab = () =>
  document.querySelector('.sc-strip-head [role="tab"][aria-selected="true"]')?.firstChild
    ?.textContent;

function mount(settings?: Record<string, unknown>) {
  const host = new FakeThemeHost({
    menu: MENU,
    games: [...FIXTURE_GAMES, ...C64_GAMES],
    art: ART,
    options: settings ? { showcase: { settings } } : {},
  });
  return renderTheme(showcaseTheme, { host });
}

async function home() {
  await waitFor(() => {
    expect(document.querySelector('.sc-start')?.textContent).toBe('Start');
  });
}

beforeEach(() => {
  resetSystemInfoCache();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        decodeURIComponent(url).endsWith('system-info/Sega Genesis.json')
          ? { ok: true, json: () => Promise.resolve({ description: 'Blast processing.' }) }
          : { ok: false, json: () => Promise.resolve({}) },
      ),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Showcase (FR-THM-1)', () => {
  it('selects the first category and shows a Start bar on the focused tile', async () => {
    mount();
    await home();
    const active = screen
      .getAllByRole('tab')
      .find((t) => t.getAttribute('aria-selected') === 'true');
    expect(active?.textContent).toBe('Nintendo');
  });

  it('the hero shows the system-info description', async () => {
    mount();
    await home();
    press('KeyE'); // Sega
    await heading('Sega Genesis');
    await screen.findByText('Blast processing.');
  });

  it('an item without a description shows its count; a system with filters counts its games', async () => {
    mount();
    await home();
    await heading('Super Nintendo');
    await screen.findByText('10 games');
    press('ArrowRight');
    await heading('Nintendo 64');
    await screen.findByText('8 games');
  });

  it('games level: info, count, wrap-around and no video window without one', async () => {
    const { view } = mount();
    await home();
    press('ArrowRight');
    await heading('Nintendo 64');
    press('Enter');
    await heading('N64 A');
    expect(screen.getByText('1990')).toBeInTheDocument();
    expect(screen.getByText('8 games')).toBeInTheDocument();
    press('ArrowLeft');
    await heading('N64 H');
    expect(view.container.querySelector('.sc-video')).toBeNull();
  });

  it('a system with filters opens its games directly, on Official, with the filters as tabs', async () => {
    const { view } = mount();
    await home();
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('Official');
    });
    expect(stripTabs()).toEqual(['Official', 'Homebrew', 'All', 'Hidden']);
    await heading('Snes A');
    expect(screen.getByText('8 games')).toBeInTheDocument();
    const logo = view.container.querySelector('.sc-info .sc-system-logo');
    expect(decodeURIComponent(logo?.getAttribute('src') ?? '')).toContain(
      'logo/clear/Super Nintendo.png',
    );
    expect(view.container.querySelector('.sc-system-filter')).toBeNull();
  });

  it('LB/RB (Q/E) move between filters; an empty one says so', async () => {
    mount();
    await home();
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('Official');
    });
    press('KeyE');
    expect(activeStripTab()).toBe('Homebrew');
    expect(screen.getByText('2 games')).toBeInTheDocument();
    press('KeyE');
    press('KeyE');
    expect(activeStripTab()).toBe('Hidden');
    expect(screen.getByText('No games in this tab')).toBeInTheDocument();
    expect(screen.getByText('0 games')).toBeInTheDocument();
  });

  it('back returns to the home; entering again opens on Official', async () => {
    mount();
    await home();
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('Official');
    });
    press('KeyE');
    press('Escape');
    await heading('Super Nintendo');
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('Official');
    });
  });

  it('a system without an Official filter opens on All; its game video plays once settled', async () => {
    const { view } = mount();
    await home();
    press('KeyQ'); // wraps to Computers
    await heading('C64');
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('All');
    });
    expect(stripTabs()).toEqual(['Hit', 'All', 'Hidden']);
    await waitFor(() => {
      expect(view.container.querySelector('.sc-video video')?.getAttribute('src')).toMatch(
        /950\/video/,
      );
    });
  });

  it('a system without filters keeps All · Favorites · Hidden after a filtered one', async () => {
    mount();
    await home();
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('Official');
    });
    press('Escape');
    await heading('Super Nintendo');
    press('ArrowRight');
    await heading('Nintendo 64');
    press('Enter');
    await waitFor(() => {
      expect(activeStripTab()).toBe('All');
    });
    expect(stripTabs()).toEqual(['All', 'Favorites', 'Hidden']);
  });

  it('filtersInMenu: true shows the filters as tiles; a filter opens with the system logo and its label', async () => {
    const { view } = mount({ filtersInMenu: true });
    await home();
    press('Enter');
    await heading('Official');
    press('Enter');
    await heading('Snes A');
    const logo = view.container.querySelector('.sc-info .sc-system-logo');
    expect(decodeURIComponent(logo?.getAttribute('src') ?? '')).toContain(
      'logo/clear/Super Nintendo.png',
    );
    expect(view.container.querySelector('.sc-system-filter')?.textContent).toBe('Official');
    expect(stripTabs()).toEqual(['All', 'Favorites', 'Hidden']);
  });

  it('back at category depth and Start open the theme menu', async () => {
    const { onExit } = mount();
    await home();
    press('Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
    press('Tab');
    expect(onExit).toHaveBeenCalledTimes(2);
  });
});
