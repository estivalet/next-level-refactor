import { err, ok, type GameListQuery, type MenuTree } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses, N64_SCOPE } from './testing.ts';

// jsdom lays nothing out; give elements a client box so the virtualized lists render rows.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const GAMES = [
  gameRow(1, 'Homebrew Demo', { year: 1999 }),
  gameRow(2, 'Homebrew Racer', { favorite: true }),
  gameRow(3, 'Lost Game', { missing: true, expectedPath: 'E:\\roms\\Nintendo 64\\Lost Game.z64' }),
  gameRow(4, 'Secret', { hidden: true }),
];
const SYSTEMS = [
  { id: 'nintendo-64', enabled: true, games: 4, missing: 1, review: 0 },
  { id: 'snes', enabled: true, games: 0, missing: 0, review: 0 },
];

describe('LibraryApp', () => {
  const MENU: MenuTree = {
    title: 'Next Level',
    items: [
      {
        id: 'm:consoles',
        name: 'Consoles',
        display: 'Consoles',
        type: 'category',
        children: [
          {
            id: 'm:nintendo',
            name: 'Nintendo',
            display: 'Nintendo',
            type: 'category',
            children: [
              {
                id: 's:nintendo-64',
                name: 'Nintendo 64',
                display: 'N64',
                type: 'system',
                systemId: 'nintendo-64',
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };

  it('D61: the Library opens on the menu; cards drill down, Back and Home return', async () => {
    const user = userEvent.setup();
    let menu = MENU;
    const bridge = installFakeBridge({
      ...libraryResponses(GAMES, SYSTEMS),
      'frontend.menu': () => ok(menu),
    });
    renderInShell(<LibraryApp />);
    const root = await screen.findByRole('list', { name: 'Next Level' });
    expect(
      within(root)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Consoles1 item', 'Collections0 items']);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.click(within(root).getByRole('button', { name: /Consoles/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo/ }));
    const trail = screen.getByRole('navigation', { name: 'Where you are' });
    expect(
      within(trail)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Next Level', 'Consoles', 'Nintendo']);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('list', { name: 'Consoles' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('list', { name: 'Next Level' })).toBeVisible();

    // Review Focus 1: the shown category leaves the menu → the deepest one left.
    await user.click(screen.getByRole('button', { name: /Consoles/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo/ }));
    // Empty categories leave the resolved menu too, so the whole Consoles branch goes.
    menu = { ...MENU, items: [] };
    bridge.emit('menus.changed', {});
    expect(await screen.findByRole('list', { name: 'Next Level' })).toBeVisible();
  });

  it('FR-LIB-6, D61: a system card lists its games and count; Back returns to its level', async () => {
    const user = userEvent.setup();
    installFakeBridge({ ...libraryResponses(GAMES, SYSTEMS), 'frontend.menu': () => ok(MENU) });
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: /Consoles/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo/ }));
    await user.click(await screen.findByRole('button', { name: /^N64/ }));
    const list = await screen.findByRole('listbox', { name: 'Games' });
    await waitFor(() => {
      expect(within(list).getAllByRole('option')).toHaveLength(3);
    });
    expect(screen.getByText('4 games · 1 missing')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('list', { name: 'Nintendo' })).toBeVisible();
  });

  it('D61: without a readable menu, systems sit in Not in menu', async () => {
    const user = userEvent.setup();
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: /Not in menu/ }));
    const level = await screen.findByRole('list', { name: 'Not in menu' });
    expect(
      within(level)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Nintendo 644 games']);
  });

  it('D61: the home view toggle switches cards to a list and is remembered', async () => {
    const user = userEvent.setup();
    installFakeBridge({ ...libraryResponses(GAMES, SYSTEMS), 'frontend.menu': () => ok(MENU) });
    const { unmount } = renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    unmount();
    renderInShell(<LibraryApp />);
    expect(await screen.findByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    localStorage.clear();
  });

  it('FR-LIB-4: a missing game is greyed with its expected path', async () => {
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    const lost = await screen.findByRole('option', { name: /Lost Game/ });
    expect(lost).toHaveAttribute(
      'title',
      'Missing — expected at E:\\roms\\Nintendo 64\\Lost Game.z64',
    );
    expect(lost.className).toContain('opacity-40');
  });

  it('FR-LIB-7: the tab filter asks for favorites, hidden or missing', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    await screen.findByRole('option', { name: /Homebrew Demo/ });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter' }), 'hidden');
    expect(await screen.findByRole('option', { name: /Secret/ })).toBeVisible();
    const tabs = bridge.calls
      .filter((call) => call.channel === 'library.games.list')
      .map((call) => (call.input as GameListQuery).tab);
    expect(tabs).toContain('hidden');
  });

  it('FR-LIB-6: the list moves with the keyboard and Shift extends the selection', async () => {
    const user = userEvent.setup();
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    const first = await screen.findByRole('option', { name: /Homebrew Demo/ });
    await user.click(first);
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    const selected = screen
      .getAllByRole('option')
      .filter((option) => option.getAttribute('aria-selected') === 'true')
      .map((option) => option.textContent);
    expect(selected).toHaveLength(2);
  });

  it('FR-LIB-6: an empty library offers Scan', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      ...libraryResponses([], []),
      'scan.start': () => ok({ running: true, progress: null, last: null }),
    });
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    await user.click(await screen.findByRole('button', { name: 'Scan for games' }));
    expect(bridge.channels()).toContain('scan.start');
  });

  it('FR-LIB-6: an unavailable library offers Open data folder', async () => {
    const user = userEvent.setup();
    const bridge = installFakeBridge({
      ...libraryResponses([]),
      'systems.list': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
      'app.openPath': () => ok(undefined),
    });
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    expect(await screen.findByText('The game library could not be opened.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open data folder' }));
    expect(bridge.calls).toContainEqual({ channel: 'app.openPath', input: { key: 'data' } });
  });

  it('FR-LIB-7: a Shift range over pages not loaded yet still acts on every game in it', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 500 }, (_, i) =>
      gameRow(i + 1, `Game ${String(i).padStart(3, '0')}`),
    );
    const flagged: number[][] = [];
    installFakeBridge({
      ...libraryResponses(many),
      'library.games.setFlags': ({ gameIds }) => {
        flagged.push(gameIds);
        return ok(undefined);
      },
    });
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    await user.click(await screen.findByRole('option', { name: /Game 000/ }));
    await user.keyboard('{Shift>}{End}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Hide' }));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveLength(500);
  });
});
