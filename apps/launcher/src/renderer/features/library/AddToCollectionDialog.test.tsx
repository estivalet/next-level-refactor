import { ok, type CollectionSummary } from '@nextlevel/shared';
import { screen, waitFor } from '@testing-library/react';
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
});
