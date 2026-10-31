import { err, ok, type GameListQuery, type MenuDocNode } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses } from './testing.ts';

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
  it('FR-LIB-6: the Library lists the first system with games and its count', async () => {
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp />);
    const tree = await screen.findByRole('tree', { name: 'Systems and collections' });
    expect(within(tree).getByRole('treeitem', { name: /Nintendo 64/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(tree).queryByText('Super Nintendo')).not.toBeInTheDocument();
    const list = await screen.findByRole('listbox', { name: 'Games' });
    await waitFor(() => {
      expect(within(list).getAllByRole('option')).toHaveLength(3);
    });
    expect(screen.getByText('4 games · 1 missing')).toBeVisible();
  });

  it('FR-MENU-3: the tree follows the active menu and updates when it changes', async () => {
    const node = (id: string, name: string, extra: Partial<MenuDocNode>): MenuDocNode => ({
      id: `00000000-0000-4000-8000-00000000000${id}`,
      name,
      displayName: null,
      shortName: null,
      filterTabs: true,
      visible: true,
      children: [],
      type: 'system',
      refId: null,
      ...extra,
    });
    const menu = (displayName: string | null) => ({
      id: '00000000-0000-4000-8000-000000000009',
      title: 'Main',
      revision: 1,
      active: true,
      source: null,
      nodes: [
        node('1', 'Consoles', {
          type: 'category',
          refId: null,
          displayName,
          children: [
            node('2', 'N64', { type: 'system', refId: 'nintendo-64', displayName: 'N64' }),
          ],
        }),
      ],
    });
    let current = menu(null);
    const systems = [
      { id: 'nintendo-64', enabled: true, games: 4, missing: 1, review: 0 },
      { id: 'snes', enabled: true, games: 2, missing: 0, review: 0 },
    ];
    const bridge = installFakeBridge({
      ...libraryResponses(GAMES, systems),
      'menus.draft': () => ok(current),
    });
    renderInShell(<LibraryApp />);
    const tree = await screen.findByRole('tree', { name: 'Systems and collections' });
    await waitFor(() => {
      expect(
        within(tree)
          .getAllByRole('treeitem')
          .map((item) => item.textContent),
      ).toEqual([
        'Consoles',
        'N644',
        'Not in menu',
        'Super Nintendo2',
        'Collections',
        'Smart filters',
      ]);
    });
    current = menu('Home consoles');
    bridge.emit('menus.changed', {});
    expect(await within(tree).findByText('Home consoles')).toBeVisible();
  });

  it('FR-LIB-4: a missing game is greyed with its expected path', async () => {
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    renderInShell(<LibraryApp />);
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
    renderInShell(<LibraryApp />);
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
    renderInShell(<LibraryApp />);
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
    renderInShell(<LibraryApp />);
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
    renderInShell(<LibraryApp />);
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
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('option', { name: /Game 000/ }));
    await user.keyboard('{Shift>}{End}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Hide' }));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveLength(500);
  });
});
