import { ok, type GameListQuery } from '@nextlevel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import i18n from '../../i18n.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses, N64_SCOPE } from './testing.ts';

// jsdom lays nothing out; give elements a client box so the virtualized views render.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
  localStorage.clear();
});

const GAMES = [
  gameRow(1, 'Alpha', { boxArt: 5 }),
  gameRow(2, 'Bravo'),
  gameRow(3, 'Charlie'),
  gameRow(4, 'Delta'),
  gameRow(5, 'Echo'),
];
const TAB_COUNTS = {
  all: 5,
  favorites: 2,
  recent: 0,
  completed: 1,
  hidden: 0,
  missing: 0,
  needsReview: 0,
};
const SYSTEMS = [
  { id: 'nintendo-64', enabled: true, games: 5, missing: 0, review: 0 },
  { id: 'snes', enabled: true, games: 2, missing: 0, review: 0 },
];

function setup(essentials = 0) {
  const bridge = installFakeBridge({
    ...libraryResponses(GAMES, SYSTEMS),
    'library.games.facets': () =>
      ok({
        filters: [
          { value: 'brazil', count: 1 },
          { value: 'hack', count: 2 },
        ],
        genres: [{ value: 'Shooter', count: 3 }],
        tabs: TAB_COUNTS,
        essentials: essentials,
      }),
    'launch.game': () => ok({ launchId: 10 }),
  });
  renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
  const lastQuery = () =>
    bridge.calls.filter((c) => c.channel === 'library.games.list').at(-1)?.input as GameListQuery;
  return { bridge, user: userEvent.setup(), lastQuery };
}

const games = () => screen.findByRole('listbox', { name: 'Games' });

describe('the scope view (D62)', () => {
  it('the heading counts the games shown, the tabs show their counts', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: /5 games/ })).toBeInTheDocument();
    const tabs = await screen.findByRole('group', { name: 'Filter' });
    const favorites = within(tabs).getByRole('button', { name: 'Favorites' });
    await waitFor(() => {
      expect(favorites).toHaveTextContent('Favorites2');
    });
  });

  it('D62: cards show box art or a placeholder of the same size', async () => {
    setup();
    const alpha = await within(await games()).findByRole('option', { name: /Alpha/ });
    const art = within(alpha).getByRole('img', { name: 'Alpha' });
    expect(art).toHaveAttribute('src', 'nextlevel://media/1/box-front?v=5');
    const bravo = within(await games()).getByRole('option', { name: /Bravo/ });
    expect(within(bravo).queryByRole('img')).not.toBeInTheDocument();
    // Review Focus 4: art that fails to load turns into the placeholder.
    fireEvent.error(art);
    expect(within(alpha).queryByRole('img')).not.toBeInTheDocument();
    expect(alpha.firstElementChild?.className).toBe(bravo.firstElementChild?.className);
  });

  it('D62: Shift+arrow extends the selection in the grid', async () => {
    const { user } = setup();
    await user.click(await within(await games()).findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
    const selected = within(await games())
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-selected') === 'true')
      .map((o) => o.textContent);
    // Four columns: Alpha → Bravo → (down) the second row's second card, clamped to Echo.
    expect(selected).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
  });

  it('D62: Enter plays, the context-menu key opens the menu', async () => {
    const { bridge, user } = setup();
    await user.click(await within(await games()).findByRole('option', { name: /Bravo/ }));
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(bridge.calls.find((c) => c.channel === 'launch.game')?.input).toEqual({ gameId: 2 });
    });
  });

  it('D62: the context-menu key opens the game menu in the grid', async () => {
    const { user } = setup();
    await user.click(await within(await games()).findByRole('option', { name: /Bravo/ }));
    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(await screen.findByRole('menu', { name: 'Game actions' })).toBeVisible();
  });

  it('D62: picking a filter narrows the list and clicking it again clears it', async () => {
    const { user, lastQuery } = setup();
    const filters = await screen.findByRole('group', { name: 'Filters' });
    const hack = await within(filters).findByRole('button', { name: /Hack/ });
    expect(hack).toHaveTextContent('2');
    await user.click(hack);
    expect(hack).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ filter: 'hack' });
    });
    // Review Focus 2: the narrowing stays across tabs.
    await user.click(screen.getByRole('button', { name: 'Favorites' }));
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ tab: 'favorites', filter: 'hack' });
    });
    // Cleared: Favorites without a filter was never fetched, so it is asked for now.
    await user.click(hack);
    expect(hack).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ tab: 'favorites' });
      expect(lastQuery().filter).toBeUndefined();
    });
  });

  it('D63: the Essentials only filter narrows the list; picking it again clears it', async () => {
    const { user, lastQuery } = setup(3);
    const essentials = await screen.findByRole('button', { name: /Essentials only/ });
    expect(essentials).toHaveTextContent('3');
    await user.click(essentials);
    expect(essentials).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ essentials: true });
    });
    await user.click(essentials);
    await waitFor(() => {
      expect(lastQuery().essentials).toBeUndefined();
    });
  });

  it("D63: counts follow the app's language, not the system's", async () => {
    await i18n.changeLanguage('pt-BR');
    try {
      setup(12345);
      const essentials = await screen.findByRole('button', { name: /Só essenciais/ });
      expect(essentials).toHaveTextContent('12.345');
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('D63: no Essentials only filter when the scope has no Essentials games', async () => {
    setup(0);
    await screen.findByRole('group', { name: 'Filters' });
    expect(screen.queryByRole('button', { name: /Essentials only/ })).toBeNull();
  });

  it('D62: genres list with counts and narrow the list', async () => {
    const { user, lastQuery } = setup();
    const genres = await screen.findByRole('group', { name: 'Genres' });
    await user.click(await within(genres).findByRole('button', { name: /Shooter/ }));
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ genre: 'Shooter' });
    });
  });

  it('D62: changing scope clears the narrowing', async () => {
    const { user, lastQuery } = setup();
    const filters = await screen.findByRole('group', { name: 'Filters' });
    await user.click(await within(filters).findByRole('button', { name: /Brazil/ }));
    await waitFor(() => {
      expect(lastQuery()).toMatchObject({ filter: 'brazil' });
    });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: /Not in menu/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo 64/ }));
    const again = await screen.findByRole('group', { name: 'Filters' });
    expect(within(again).getByRole('button', { name: /Brazil/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('D62: the view toggle is remembered per scope', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: /Not in menu/ }));
    await user.click(await screen.findByRole('button', { name: /^Super Nintendo/ }));
    expect(await screen.findByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo 64/ }));
    expect(await screen.findByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('D62: a manual-order collection opens in the grid and can switch to the list', async () => {
    installFakeBridge({
      ...libraryResponses(GAMES, SYSTEMS),
      'collections.list': () => ok([{ id: 1, name: 'Picks', sort: 'manual', games: 5 }]),
    });
    const user = userEvent.setup();
    renderInShell(<LibraryApp initialScope={{ kind: 'collection', collectionId: 1 }} />);
    const grid = await screen.findByRole('button', { name: 'Grid view' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    expect(grid).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Final: a scope opened from the home lays the grid out in columns', async () => {
    installFakeBridge(libraryResponses(GAMES, SYSTEMS));
    const user = userEvent.setup();
    renderInShell(<LibraryApp />);
    await user.click(await screen.findByRole('button', { name: /Not in menu/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo 64/ }));
    const bravo = await within(await games()).findByRole('option', { name: /Bravo/ });
    const alpha = within(await games()).getByRole('option', { name: /Alpha/ });
    // 800px wide: four columns, so Bravo sits right of Alpha on the same row.
    expect(bravo.style.top).toBe(alpha.style.top);
    expect(parseFloat(bravo.style.left)).toBeGreaterThan(parseFloat(alpha.style.left));
  });

  it('Final: a picked filter the tab lacks stays shown, pressed and clearable', async () => {
    const bridge = installFakeBridge({
      ...libraryResponses(GAMES, SYSTEMS),
      'library.games.facets': ({ tab }) =>
        ok({
          filters: tab === 'all' ? [{ value: 'hack', count: 2 }] : [],
          genres: [],
          tabs: TAB_COUNTS,
          essentials: 0,
        }),
    });
    const user = userEvent.setup();
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    const filters = await screen.findByRole('group', { name: 'Filters' });
    await user.click(await within(filters).findByRole('button', { name: /Hack/ }));
    await user.click(screen.getByRole('button', { name: 'Favorites' }));
    await waitFor(() => {
      expect(
        bridge.calls.some(
          (c) =>
            c.channel === 'library.games.facets' &&
            (c.input as { tab: string }).tab === 'favorites',
        ),
      ).toBe(true);
    });
    const hack = await within(await screen.findByRole('group', { name: 'Filters' })).findByRole(
      'button',
      { name: /Hack/ },
    );
    expect(hack).toHaveAttribute('aria-pressed', 'true');
    expect(hack).toHaveTextContent('0');
    await user.click(hack);
    expect(screen.queryByRole('group', { name: 'Filters' })).not.toBeInTheDocument();
  });
});

describe('search within the open list (FR-LIB-10, D66)', () => {
  function searchSetup(matches: (text: string) => number[] = () => [1]) {
    const base = libraryResponses(GAMES, SYSTEMS);
    const list = base['library.games.list'];
    if (!list) throw new Error('no list response');
    const exports: unknown[] = [];
    const bridge = installFakeBridge({
      ...base,
      'library.games.facets': () =>
        ok({ filters: [], genres: [], tabs: TAB_COUNTS, essentials: 0 }),
      'library.games.list': (query) => {
        if (query.text === undefined) return list(query);
        const rows = GAMES.filter((game) => matches(query.text ?? '').includes(game.id));
        return ok({ total: rows.length, offset: query.offset, games: rows });
      },
      'library.export': (input) => {
        exports.push(input);
        return ok({ status: 'saved' as const, count: 1 });
      },
    });
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    const listCalls = () =>
      bridge.calls
        .filter((c) => c.channel === 'library.games.list')
        .map((c) => c.input as GameListQuery);
    return { user: userEvent.setup(), listCalls, exports };
  }

  it('FR-LIB-10: typing in Search Nintendo 64 narrows the list to the scope', async () => {
    const { user, listCalls } = searchSetup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' }), 'alpha');
    await waitFor(() => {
      expect(listCalls().at(-1)).toMatchObject({ scope: N64_SCOPE, text: 'alpha' });
    });
  });

  it('FR-LIB-10: typing fast sends one query after the pause', async () => {
    const { user, listCalls } = searchSetup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' }), 'alpha');
    await waitFor(() => {
      expect(
        listCalls()
          .filter((q) => q.text !== undefined)
          .map((q) => q.text),
      ).toEqual(['alpha']);
    });
  });

  it('FR-LIB-10: the header shows "n of total games" while searching; no match shows 0 of total', async () => {
    const { user } = searchSetup((text) => (text === 'alpha' ? [1] : []));
    const box = await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' });
    await user.type(box, 'alpha');
    expect(await screen.findByText('1 of 5 games')).toBeVisible();
    await user.clear(box);
    await user.type(box, 'zzz');
    expect(await screen.findByText('0 of 5 games')).toBeVisible();
  });

  it('FR-LIB-10: with a genre picked, the total is the narrowed list, not the whole tab', async () => {
    const base = libraryResponses(GAMES, SYSTEMS);
    installFakeBridge({
      ...base,
      'library.games.facets': () =>
        ok({
          filters: [],
          genres: [{ value: 'Shooter', count: 3 }],
          tabs: TAB_COUNTS,
          essentials: 0,
        }),
      'library.games.list': (query) => {
        const pool = query.genre === 'Shooter' ? GAMES.slice(0, 3) : GAMES;
        const rows = query.text === undefined ? pool : pool.slice(0, 1);
        return ok({ total: rows.length, offset: query.offset, games: rows });
      },
    });
    renderInShell(<LibraryApp initialScope={N64_SCOPE} />);
    const user = userEvent.setup();
    const genres = await screen.findByRole('group', { name: 'Genres' });
    await user.click(await within(genres).findByRole('button', { name: /Shooter/ }));
    expect(await screen.findByText('3 games')).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: 'Search Nintendo 64…' }), 'alpha');
    expect(await screen.findByText('1 of 3 games')).toBeVisible();
  });

  it('FR-LIB-10: opening another scope or Back clears the search', async () => {
    const { user, listCalls } = searchSetup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' }), 'alpha');
    await waitFor(() => {
      expect(listCalls().at(-1)?.text).toBe('alpha');
    });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: /Not in menu/ }));
    await user.click(await screen.findByRole('button', { name: /^Nintendo 64/ }));
    expect(await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' })).toHaveValue('');
    expect(listCalls().at(-1)?.text).toBeUndefined();
  });

  it('FR-LIB-10: Export… keeps the search text', async () => {
    const { user, exports } = searchSetup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search Nintendo 64…' }), 'alpha');
    expect(await screen.findByText('1 of 5 games')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Export…' }));
    const dialog = await screen.findByRole('dialog', { name: /Export/ });
    await user.click(within(dialog).getByRole('radio', { name: /Only the games shown/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Export…' }));
    await waitFor(() => {
      expect(exports[0]).toMatchObject({ view: { text: 'alpha' } });
    });
  });
});
