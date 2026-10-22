import { err, ok, type CollectionSummary, type GameListQuery } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
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

const GAMES = [gameRow(1, 'Alpha'), gameRow(2, 'Bravo'), gameRow(3, 'Charlie')];

/** A fake library with collections kept in memory, as main would. */
function setup(initial: CollectionSummary[] = []) {
  const collections = [...initial];
  const members = new Map<number, number[]>(initial.map((c) => [c.id, [1, 2, 3]]));
  const base = libraryResponses(GAMES);
  const bridge = installFakeBridge({
    ...base,
    'collections.list': () => ok([...collections]),
    'collections.create': ({ name }) => {
      if (collections.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        return err('NAME_TAKEN', 'errors.nameTaken');
      }
      const created = { id: collections.length + 10, name, sort: 'manual' as const, games: 0 };
      collections.push(created);
      members.set(created.id, []);
      return ok(created);
    },
    'collections.addGames': ({ id, gameIds }) => {
      members.set(id, [...(members.get(id) ?? []), ...gameIds]);
      const summary = collections.find((c) => c.id === id);
      if (!summary) return err('NOT_FOUND', 'errors.notFound');
      summary.games = members.get(id)?.length ?? 0;
      return ok(summary);
    },
    'collections.delete': ({ id }) => {
      collections.splice(
        collections.findIndex((c) => c.id === id),
        1,
      );
      return ok(undefined);
    },
    'collections.reorder': () => ok(undefined),
    'library.games.list': (query: GameListQuery) => {
      if (query.scope.kind !== 'collection') return base['library.games.list']?.(query) as never;
      const ids = members.get(query.scope.collectionId) ?? [];
      const rows = GAMES.filter((game) => ids.includes(game.id));
      return ok({ total: rows.length, offset: 0, games: rows });
    },
  });
  renderInShell(<LibraryApp />);
  return { bridge, collections };
}

const tree = () => screen.getByRole('tree', { name: 'Systems and collections' });

describe('collections in the Library', () => {
  it('FR-LIB-8: creating a collection shows it in the tree; a taken name shows the error inline', async () => {
    const user = userEvent.setup();
    setup([{ id: 1, name: 'Picks', sort: 'manual', games: 3 }]);
    await user.click(await screen.findByRole('button', { name: 'New collection' }));
    const dialog = await screen.findByRole('dialog', { name: 'New collection' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.type(name, 'picks');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('That name is already in use.')).toBeVisible();
    await user.clear(name);
    await user.type(name, 'Shooters');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(tree()).findByRole('treeitem', { name: /Shooters/ })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('FR-LIB-8: adding selected games to a collection sends their ids', async () => {
    const user = userEvent.setup();
    const { bridge } = setup([{ id: 1, name: 'Picks', sort: 'manual', games: 0 }]);
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('option', { name: /Bravo/ }),
    });
    await user.click(screen.getByRole('menuitem', { name: 'Add to collection…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add 2 games to a collection' });
    await user.click(within(dialog).getByRole('button', { name: 'Picks' }));
    expect(bridge.calls).toContainEqual({
      channel: 'collections.addGames',
      input: { id: 1, gameIds: [1, 2] },
    });
  });

  it('FR-LIB-8: Move down reorders the manual collection', async () => {
    const user = userEvent.setup();
    const { bridge } = setup([{ id: 1, name: 'Picks', sort: 'manual', games: 3 }]);
    await user.click(await screen.findByRole('treeitem', { name: /Picks/ }));
    await user.click(await screen.findByRole('option', { name: /Alpha/ }));
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move down' }));
    expect(bridge.calls).toContainEqual({
      channel: 'collections.reorder',
      input: { id: 1, gameId: 1, swapWithGameId: 2 },
    });
  });

  it('FR-LIB-8: deleting a collection asks first and returns to the first system', async () => {
    const user = userEvent.setup();
    const { bridge } = setup([{ id: 1, name: 'Picks', sort: 'manual', games: 3 }]);
    await user.click(await screen.findByRole('treeitem', { name: /Picks/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Picks?' });
    expect(bridge.channels()).not.toContain('collections.delete');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(within(tree()).queryByRole('treeitem', { name: /Picks/ })).not.toBeInTheDocument();
    });
    expect(within(tree()).getByRole('treeitem', { name: /Nintendo 64/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('FR-LIB-8: a library change (e.g. a relink) refreshes collection counts', async () => {
    const { bridge } = setup([{ id: 1, name: 'Picks', sort: 'manual', games: 3 }]);
    await screen.findByRole('treeitem', { name: /Picks/ });
    const before = bridge.channels().filter((c) => c === 'collections.list').length;
    bridge.emit('library.changed', { systems: ['nintendo-64'], gameIds: [1] });
    await waitFor(() => {
      expect(bridge.channels().filter((c) => c === 'collections.list').length).toBeGreaterThan(
        before,
      );
    });
  });
});
