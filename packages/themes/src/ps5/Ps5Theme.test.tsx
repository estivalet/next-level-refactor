// Cases ported from NextLevelOS src/themes/ps5/Ps5Theme.test.tsx @ 3d530b7 on a FakeThemeHost
// (categories Nintendo · Sega · Collections), driven by input actions (US-C1).
import type { MenuNode, MenuTree } from '@nextlevel/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useNavigationSound } from '../components/useNavigationSound.ts';
import { ThemeArtProvider } from '../engine/ThemeArtProvider.tsx';
import { ThemeEngineProvider } from '../engine/ThemeEngineProvider.tsx';
import { useThemeNavigation } from '../engine/useThemeNavigation.ts';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_MENU } from '../host/fixtures.ts';
import { NO_ART_FILES, press, renderTheme, shows } from '../themeTestUtils.tsx';
import { ps5Theme } from './index.ts';
import { Ps5Theme } from './Ps5Theme.tsx';

vi.mock('../components/useNavigationSound.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/useNavigationSound.ts')>()),
  useNavigationSound: vi.fn(),
}));

const lastSound = () => vi.mocked(useNavigationSound).mock.calls.at(-1)?.[0];

const systemNode = (id: string, name: string): MenuNode => ({
  id: `s:${id}`,
  name,
  display: name,
  type: 'system',
  systemId: id,
  children: [],
});

/** The fixture menu plus Nintendo 64 directly under the root. */
const WITH_ROOT_SYSTEM: MenuTree = {
  ...FIXTURE_MENU,
  items: [...FIXTURE_MENU.items, systemNode('n64', 'Solo 64')],
};

const many = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => systemNode(`${prefix}${String(i)}`, `${prefix}${String(i)}`));
const category = (name: string, children: MenuNode[]): MenuNode => ({
  id: `m:${name}`,
  name,
  display: name,
  type: 'category',
  children,
});

const activeCategory = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
    ?.textContent;
const shelf = () => document.querySelector('[data-window-start]') as HTMLElement;

function mount(menu?: MenuTree) {
  return renderTheme(ps5Theme, {
    host: new FakeThemeHost({ art: NO_ART_FILES, ...(menu ? { menu } : {}) }),
  });
}

async function ready(menu?: MenuTree, first = 'Nintendo') {
  const ctx = mount(menu);
  await waitFor(() => {
    expect(activeCategory()).toBe(first);
  });
  return ctx;
}

describe('PS5 Style (FR-THM-1)', () => {
  it('auto-selects the first category and shows its items on the shelf', async () => {
    await ready();
    expect(screen.getAllByText('Super Nintendo').length).toBeGreaterThan(0);
  });

  it('LB/RB (Q/E) switch category, wrapping', async () => {
    await ready();
    press('KeyE');
    await waitFor(() => {
      expect(activeCategory()).toBe('Sega');
    });
    expect(screen.getAllByText('Sega Genesis').length).toBeGreaterThan(0);
    press('KeyQ');
    await waitFor(() => {
      expect(activeCategory()).toBe('Nintendo');
    });
    press('KeyQ');
    await waitFor(() => {
      expect(activeCategory()).toBe('Collections');
    });
    expect(screen.getAllByText('Party picks').length).toBeGreaterThan(0);
  });

  it('shows the game count of the focused system', async () => {
    await ready();
    press('ArrowRight'); // Nintendo 64
    await shows('8 games');
  });

  it('select on a system with filters drills in; a system opens a 5-column grid', async () => {
    await ready();
    press('Enter'); // Super Nintendo → its filters
    await shows('Homebrew');
    press('Escape');
    await waitFor(() => {
      expect(activeCategory()).toBe('Nintendo');
    });
    press('ArrowRight'); // Nintendo 64
    press('Enter');
    await screen.findByRole('tab', { name: /All/ });
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole('row')[0]?.children).toHaveLength(5);
  });

  it('back at category depth opens the theme menu', async () => {
    const { onExit } = await ready();
    press('Escape');
    expect(onExit).toHaveBeenCalled();
  });

  it('back with search open on a category-depth games level closes the search first', async () => {
    const { onExit } = await ready(WITH_ROOT_SYSTEM);
    press('KeyQ'); // Solo 64, a system right under the root
    await screen.findByRole('tab', { name: /All/ });
    press('KeyF');
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'N64 B' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    press('Escape');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
    press('Escape');
    expect(onExit).toHaveBeenCalled();
  });

  it('a games level plays, favorites and jumps a page (D5)', async () => {
    const { host } = await ready();
    press('ArrowRight');
    press('Enter');
    await screen.findByRole('tab', { name: /All/ });
    press('PageDown');
    press('KeyX');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Favorites/ })).toHaveTextContent('1');
    });
    press('Enter');
    const last = host.calls.filter((call) => call.method === 'launch').at(-1);
    expect(last?.args).toEqual([18]); // N64 H, the last game
  });

  it('the games header counts the active tab through i18n', async () => {
    await ready();
    press('ArrowRight');
    press('Enter');
    await screen.findByRole('tab', { name: /All/ });
    expect(i18n.exists('themes.ps5.tabCount')).toBe(true);
    expect(document.querySelector('.ps5-games-count')?.textContent).toBe('All: 8');
  });

  it('help opens the key help', async () => {
    await ready();
    press('F1');
    expect(screen.getByRole('dialog', { name: 'Controls' })).toBeInTheDocument();
  });

  it('a category switch resets the shelf: first item at the fixed 3rd slot', async () => {
    await ready(
      {
        title: 'NextLevel',
        items: [category('One', many('A', 19)), category('Two', many('B', 18))],
      },
      'One',
    );
    for (let i = 0; i < 3; i++) press('ArrowRight');
    press('KeyE');
    await waitFor(() => {
      expect(activeCategory()).toBe('Two');
    });
    expect(shelf().getAttribute('data-window-start')).toBe('-2');
    expect(shelf().querySelector('[data-focused="true"]')?.getAttribute('data-virtual')).toBe('0');
  });

  it('moving right keeps the highlight on the 3rd slot and slides the shelf', async () => {
    await ready({ title: 'NextLevel', items: [category('One', many('S', 19))] }, 'One');
    press('ArrowRight');
    press('ArrowRight');
    const focused = shelf().querySelector<HTMLElement>('[data-focused="true"]');
    expect(Number(focused?.dataset.virtual) - Number(shelf().dataset.windowStart)).toBe(2);
    expect(shelf().getAttribute('data-window-start')).toBe('0');
  });

  it('the breadcrumb sits right after the active category', async () => {
    await ready();
    press('Enter'); // Super Nintendo's filter menu
    const trail = await screen.findByText(/› Super Nintendo/);
    const tab = trail.previousElementSibling as HTMLElement;
    expect(tab.getAttribute('role')).toBe('tab');
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.textContent).toBe('Nintendo');
  });

  it('FR-THM-1: keeps the place when mounted below the root (theme switch)', async () => {
    function Switcher() {
      const nav = useThemeNavigation();
      const [ps5, setPs5] = useState(false);
      if (ps5) return <Ps5Theme onExit={() => undefined} />;
      return (
        <div>
          <span data-testid="depth">{nav.state.stack.length}</span>
          <button
            type="button"
            onClick={() => {
              nav.enter(0);
            }}
          >
            in0
          </button>
          <button
            type="button"
            onClick={() => {
              setPs5(true);
            }}
          >
            go
          </button>
        </div>
      );
    }
    const host = new FakeThemeHost({ art: NO_ART_FILES });
    render(
      <ThemeEngineProvider host={host} onExit={() => undefined}>
        <ThemeArtProvider host={host} themeId="ps5" moduleArt={ps5Theme.art}>
          <Switcher />
        </ThemeArtProvider>
      </ThemeEngineProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('depth').textContent).toBe('1');
    });
    fireEvent.click(screen.getByText('in0')); // Nintendo
    await waitFor(() => {
      expect(screen.getByTestId('depth').textContent).toBe('2');
    });
    fireEvent.click(screen.getByText('in0')); // Super Nintendo's filters
    await waitFor(() => {
      expect(screen.getByTestId('depth').textContent).toBe('3');
    });
    fireEvent.click(screen.getByText('go'));
    await shows('Homebrew');
    expect(activeCategory()).toBe('Nintendo');
  });

  it('navigation sound: shelf moves play, category switches are level changes', async () => {
    vi.mocked(useNavigationSound).mockClear();
    await ready();
    await waitFor(() => {
      expect(lastSound()?.levelKind).toBe('menu');
    });
    const level = lastSound()?.levelKey;
    const focus = lastSound()?.focusKey;
    press('ArrowRight');
    await waitFor(() => {
      expect(lastSound()?.focusKey).not.toBe(focus);
    });
    expect(lastSound()?.levelKey).toBe(level);
    press('KeyE');
    await waitFor(() => {
      expect(activeCategory()).toBe('Sega');
    });
    expect(lastSound()?.levelKey).not.toBe(level);
    press('F1');
    await waitFor(() => {
      expect(lastSound()?.muted).toBe(true);
    });
  });
});
