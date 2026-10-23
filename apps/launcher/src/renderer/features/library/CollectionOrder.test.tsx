import { ok, type CollectionSummary, type GameListQuery } from '@nextlevel/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameRow, libraryResponses } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const GAMES = [
  gameRow(1, 'Alpha'),
  gameRow(2, 'Bravo'),
  gameRow(3, 'Charlie'),
  gameRow(4, 'Alpine Racer'),
  gameRow(5, 'Altitude'),
];

function setup(sort: CollectionSummary['sort'] = 'manual') {
  const collection: CollectionSummary = { id: 1, name: 'Picks', sort, games: 3 };
  const base = libraryResponses(GAMES);
  const bridge = installFakeBridge({
    ...base,
    'collections.list': () => ok([collection]),
    'collections.move': () => ok(undefined),
    'collections.gameIds': () => ok([1, 2, 3]),
    'collections.addGames': () => ok(collection),
    'library.search': ({ text }) =>
      ok({
        games: GAMES.filter((g) => g.title.toLowerCase().includes(text.toLowerCase())),
        more: false,
      }),
    'library.games.list': (query: GameListQuery) => {
      if (query.scope.kind !== 'collection') return base['library.games.list']?.(query) as never;
      const rows = GAMES.slice(0, 3);
      return ok({ total: rows.length, offset: 0, games: rows });
    },
  });
  renderInShell(<LibraryApp />);
  const user = userEvent.setup();
  const open = async () => {
    const tree = await screen.findByRole('tree', { name: 'Systems and collections' });
    await user.click(await within(tree).findByRole('treeitem', { name: /Picks/ }));
    return screen.findByRole('listbox', { name: 'Games' });
  };
  const moved = () => bridge.calls.find((call) => call.channel === 'collections.move')?.input;
  return { bridge, user, open, moved };
}

const DATA = { dataTransfer: { setData: () => undefined, effectAllowed: '' } };

describe('collection order (FR-LIB-8, D11)', () => {
  it('dragging a row onto another puts it before that one', async () => {
    const { open, moved } = setup();
    const list = await open();
    const charlie = await within(list).findByRole('option', { name: /Charlie/ });
    const alpha = within(list).getByRole('option', { name: /Alpha/ });
    fireEvent.dragStart(charlie, DATA);
    fireEvent.dragOver(alpha, DATA);
    fireEvent.drop(alpha, DATA);
    await waitFor(() => {
      expect(moved()).toEqual({ id: 1, gameIds: [3], beforeGameId: 1 });
    });
  });

  it('dragging a selected row moves the whole selection in order', async () => {
    const { open, moved, user } = setup();
    const list = await open();
    await user.click(await within(list).findByRole('option', { name: /Bravo/ }));
    await user.keyboard('{Shift>}');
    await user.click(within(list).getByRole('option', { name: /Charlie/ }));
    await user.keyboard('{/Shift}');
    const charlie = within(list).getByRole('option', { name: /Charlie/ });
    const alpha = within(list).getByRole('option', { name: /Alpha/ });
    fireEvent.dragStart(charlie, DATA);
    fireEvent.dragOver(alpha, DATA);
    fireEvent.drop(alpha, DATA);
    await waitFor(() => {
      expect(moved()).toEqual({ id: 1, gameIds: [2, 3], beforeGameId: 1 });
    });
  });

  it('rows do not drag while the collection is sorted by title', async () => {
    const { open } = setup('title');
    const list = await open();
    expect(await within(list).findByRole('option', { name: /Alpha/ })).not.toHaveAttribute(
      'draggable',
      'true',
    );
  });

  it('Add games… adds search results; games already in are ticked and off', async () => {
    const { bridge, user, open } = setup();
    await open();
    await user.click(await screen.findByRole('button', { name: 'Add games…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add games to Picks' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search games' }), 'al');
    const alpha = await within(dialog).findByRole('checkbox', { name: /^Alpha/ });
    expect(alpha).toBeChecked();
    expect(alpha).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: /Alpine Racer/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Altitude/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 games' }));
    await waitFor(() => {
      expect(bridge.calls.find((c) => c.channel === 'collections.addGames')?.input).toEqual({
        id: 1,
        gameIds: [4, 5],
      });
    });
  });
});
