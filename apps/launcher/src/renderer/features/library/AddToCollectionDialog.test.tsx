import { ok, type CollectionSummary } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { AddToCollection } from './AddToCollectionDialog.tsx';
import { gameDetails, gameRow } from './testing.ts';

afterEach(() => {
  setBridgeForTests(null);
});

const PICKS: CollectionSummary = { id: 10, name: 'Picks', sort: 'manual', games: 0 };

describe('AddToCollection (FR-LIB-8)', () => {
  it('ticks the box at once, before the save comes back', async () => {
    let finish: () => void = () => undefined;
    const members: number[] = [];
    installFakeBridge({
      'collections.list': () => ok([PICKS]),
      'library.games.get': () =>
        ok(gameDetails(gameRow(1, 'Alpha'), { collectionIds: members.includes(1) ? [10] : [] })),
      'collections.addGames': () =>
        new Promise((resolve) => {
          finish = () => {
            members.push(1);
            resolve(ok({ ...PICKS, games: 1 }));
          };
        }),
    });
    renderInShell(<AddToCollection gameIds={[1]} onClose={vi.fn()} />);
    const box = await screen.findByRole('checkbox', { name: 'Picks' });
    await waitFor(() => {
      expect(box).toBeEnabled();
    });

    await userEvent.click(box);
    expect(box).toBeChecked();

    finish();
    await waitFor(() => {
      expect(box).toBeEnabled();
    });
    expect(box).toBeChecked();
  });

  /** A fake library that keeps the collections and their members in memory. */
  function library(initial: CollectionSummary[]) {
    const collections = [...initial];
    const members = new Map<number, number[]>(initial.map((c) => [c.id, []]));
    const bridge = installFakeBridge({
      'collections.list': () => ok([...collections]),
      'collections.create': ({ name }) => {
        const created = { id: 20 + collections.length, name, sort: 'manual' as const, games: 0 };
        collections.push(created);
        members.set(created.id, []);
        return ok(created);
      },
      'collections.addGames': ({ id, gameIds }) => {
        members.set(id, [...(members.get(id) ?? []), ...gameIds]);
        const summary = collections.find((c) => c.id === id) ?? PICKS;
        return ok({ ...summary, games: members.get(id)?.length ?? 0 });
      },
      'library.games.get': ({ gameId }) =>
        ok(
          gameDetails(gameRow(gameId, `Game ${String(gameId)}`), {
            collectionIds: [...members].filter(([, ids]) => ids.includes(gameId)).map(([id]) => id),
          }),
        ),
    });
    return bridge;
  }

  it('creates a collection from the typed name and adds the selected games to it', async () => {
    const user = userEvent.setup();
    const bridge = library([PICKS]);
    renderInShell(<AddToCollection gameIds={[1, 2]} onClose={vi.fn()} />);
    const box = await screen.findByRole('searchbox', { name: 'Find or create a collection…' });

    await user.type(box, '  Racers ');
    await user.click(screen.getByRole('button', { name: 'New collection “Racers”' }));

    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        channel: 'collections.addGames',
        input: { id: 21, gameIds: [1, 2] },
      });
    });
    expect(bridge.calls).toContainEqual({
      channel: 'collections.create',
      input: { name: 'Racers' },
    });
    // The box clears and the new collection shows ticked, with the dialog still open.
    expect(box).toHaveValue('');
    const racers = await screen.findByRole('checkbox', { name: 'Racers' });
    await waitFor(() => {
      expect(racers).toBeChecked();
    });
  });

  it('offers no new collection when the name is already there, in any case', async () => {
    const user = userEvent.setup();
    library([PICKS]);
    renderInShell(<AddToCollection gameIds={[1]} onClose={vi.fn()} />);
    await user.type(await screen.findByRole('searchbox'), 'picks');
    expect(screen.queryByRole('button', { name: /New collection/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Picks' })).toBeInTheDocument();
  });

  it('Enter creates the collection when there is none yet', async () => {
    const user = userEvent.setup();
    const bridge = library([]);
    renderInShell(<AddToCollection gameIds={[3]} onClose={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('No collections yet. Type a name above to create one.'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByRole('searchbox'), 'Shooters{Enter}');

    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        channel: 'collections.addGames',
        input: { id: 20, gameIds: [3] },
      });
    });
  });
});
