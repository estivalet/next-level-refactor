import { ok, type GameListQuery } from '@nextlevel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
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

function setup() {
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

  it('D62: a manual-order collection shows the list', async () => {
    installFakeBridge({
      ...libraryResponses(GAMES, SYSTEMS),
      'collections.list': () => ok([{ id: 1, name: 'Picks', sort: 'manual', games: 5 }]),
    });
    renderInShell(<LibraryApp initialScope={{ kind: 'collection', collectionId: 1 }} />);
    expect(await screen.findByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Grid view' })).toBeDisabled();
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
