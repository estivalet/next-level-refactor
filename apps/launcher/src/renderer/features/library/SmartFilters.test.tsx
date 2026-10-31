import {
  ok,
  SmartFilterQuerySchema,
  type GameListQuery,
  type SmartFilterSummary,
} from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses, openCollectionsLevel } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const GAMES = [
  gameRow(1, 'Star Shooter', { genre: 'Shoot em up' }),
  gameRow(2, 'Puzzle Park', { genre: 'Puzzle' }),
  gameRow(3, 'Sky Shooter', { genre: 'Shoot em up', favorite: true }),
];

const BUILT_INS: SmartFilterSummary[] = [
  {
    id: 1,
    name: 'Favorites',
    query: SmartFilterQuerySchema.parse({ favorite: true }),
    games: 1,
    menus: 0,
  },
  {
    id: 2,
    name: 'Most played',
    query: SmartFilterQuerySchema.parse({ played: 'played', sort: 'playCount', limit: 50 }),
    games: 0,
    menus: 2,
  },
  {
    id: 3,
    name: 'Nineties',
    query: SmartFilterQuerySchema.parse({ yearFrom: 1990, yearTo: 1995 }),
    games: 0,
    menus: 0,
  },
];

/** A library with smart filters kept in memory; a filter's games match its genre or favorite. */
async function setup() {
  const filters = [...BUILT_INS];
  const base = libraryResponses(GAMES);
  const matches = (id: number) => {
    const query = filters.find((f) => f.id === id)?.query;
    return GAMES.filter(
      (game) =>
        (!query?.favorite || game.favorite) &&
        (!query?.genre || (game.genre ?? '').toLowerCase().includes(query.genre.toLowerCase())),
    );
  };
  const bridge = installFakeBridge({
    ...base,
    'smartFilters.list': () => ok([...filters]),
    'smartFilters.create': ({ name, query }) => {
      const filter = { id: filters.length + 10, name, query, games: 0, menus: 0 };
      filter.games = 0;
      filters.push(filter);
      filter.games = matches(filter.id).length;
      return ok(filter);
    },
    'smartFilters.delete': ({ id }) => {
      filters.splice(
        filters.findIndex((f) => f.id === id),
        1,
      );
      return ok(undefined);
    },
    'library.games.list': (query: GameListQuery) => {
      if (query.scope.kind !== 'smartFilter') return base['library.games.list']?.(query) as never;
      const rows = matches(query.scope.smartFilterId);
      return ok({ total: rows.length, offset: 0, games: rows });
    },
  });
  renderInShell(<LibraryApp />);
  const user = userEvent.setup();
  await openCollectionsLevel(user);
  return { bridge, user };
}

const tree = () => screen.findByRole('list', { name: 'Collections' });

describe('Library smart filters', () => {
  it('FR-LIB-9: the built-in smart filters are listed with their counts', async () => {
    await setup();
    const favorites = await within(await tree()).findByRole('button', { name: /Favorites/ });
    expect(favorites).toHaveTextContent('1');
    expect(within(await tree()).getByRole('button', { name: /Most played/ })).toHaveTextContent(
      '0',
    );
  });

  it('FR-LIB-9: a new "Shooters" filter (genre shoot) appears and lists matching games', async () => {
    const { bridge, user } = await setup();
    await user.click(await screen.findByRole('button', { name: 'New smart filter' }));
    const dialog = await screen.findByRole('dialog', { name: 'New smart filter' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Shooters');
    await user.type(within(dialog).getByRole('textbox', { name: 'Genre contains' }), 'shoot');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bridge.channels()).toContain('smartFilters.create');
    });
    const created = bridge.calls.find((c) => c.channel === 'smartFilters.create')?.input;
    expect(created).toMatchObject({ name: 'Shooters', query: { genre: 'shoot' } });
    await user.click(await within(await tree()).findByRole('button', { name: /Shooters/ }));
    const list = await screen.findByRole('listbox', { name: 'Games' });
    await waitFor(() => {
      expect(
        within(list)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual([expect.stringContaining('Star Shooter'), expect.stringContaining('Sky Shooter')]);
    });
  });

  it('FR-LIB-9: a year range that runs backwards shows the message and disables Save', async () => {
    const { user } = await setup();
    await user.click(await screen.findByRole('button', { name: 'New smart filter' }));
    const dialog = await screen.findByRole('dialog', { name: 'New smart filter' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Nineties');
    await user.type(within(dialog).getByRole('textbox', { name: 'Year from' }), '1995');
    await user.type(within(dialog).getByRole('textbox', { name: 'Year to' }), '1990');
    expect(within(dialog).getByText('Year to must not be before Year from.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('FR-LIB-9: delete asks and says how many menus show the filter', async () => {
    const { bridge, user } = await setup();
    await user.click(await within(await tree()).findByRole('button', { name: /Most played/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete smart filter' }));
    const ask = await screen.findByRole('dialog', { name: 'Delete smart filter' });
    expect(ask).toHaveTextContent('Used in 2 menus');
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(bridge.channels()).toContain('smartFilters.delete');
    });
    expect(
      within(await tree()).queryByRole('button', { name: /Most played/ }),
    ).not.toBeInTheDocument();
  });

  it('FR-LIB-9: a game change from main refreshes the smart filter counts', async () => {
    const { bridge } = await setup();
    await within(await tree()).findByRole('button', { name: /Favorites/ });
    const lists = () => bridge.channels().filter((c) => c === 'smartFilters.list').length;
    const before = lists();
    bridge.emit('library.changed', { systems: ['nintendo-64'], gameIds: [2] });
    await waitFor(() => {
      expect(lists()).toBeGreaterThan(before);
    });
  });

  it('FR-LIB-9: raising Year from past a saved Year to shows why Save is off', async () => {
    const { user } = await setup();
    await user.click(await within(await tree()).findByRole('button', { name: /Nineties/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit smart filter' });
    const from = within(dialog).getByRole('textbox', { name: 'Year from' });
    await user.clear(from);
    await user.type(from, '1999');
    expect(within(dialog).getByText('Year to must not be before Year from.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
