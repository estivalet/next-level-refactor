import { ok, type GameListQuery, type SystemInfoTopGame } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { TopGamesEditor } from './TopGamesEditor.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

function row(id: number, title: string) {
  return {
    id,
    systemId: 'snes',
    title,
    year: 1994,
    genre: null,
    players: null,
    favorite: false,
    completed: false,
    hidden: false,
    missing: false,
    userRating: null,
    boxArt: null,
    expectedPath: null,
  };
}

function Harness({ onChange }: { onChange: (games: SystemInfoTopGame[]) => void }) {
  const [games, setGames] = useState<SystemInfoTopGame[]>([{ title: 'Super Metroid' }]);
  return (
    <TopGamesEditor
      systemId="snes"
      games={games}
      errors={{}}
      onChange={(next) => {
        setGames(next);
        onChange(next);
      }}
    />
  );
}

describe('TopGamesEditor', () => {
  it('FR-MUS-3: top games can be added, reordered, linked to a library game and unlinked', async () => {
    const queries: GameListQuery[] = [];
    installFakeBridge({
      'library.games.list': (query) => {
        queries.push(query);
        return ok({ total: 1, offset: 0, games: [row(42, 'Super Metroid (USA)')] });
      },
    });
    const user = userEvent.setup();
    let latest: SystemInfoTopGame[] = [];
    renderInShell(
      <Harness
        onChange={(next) => {
          latest = next;
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add top game' }));
    const titles = screen.getAllByLabelText('Title');
    await user.type(titles[1] as HTMLElement, 'Chrono Trigger');
    expect(latest.map((game) => game.title)).toEqual(['Super Metroid', 'Chrono Trigger']);

    await user.click(screen.getAllByRole('button', { name: 'Move up' })[1] as HTMLElement);
    expect(latest.map((game) => game.title)).toEqual(['Chrono Trigger', 'Super Metroid']);

    await user.click(
      screen.getAllByRole('button', { name: 'Link to library game' })[1] as HTMLElement,
    );
    const picker = await screen.findByRole('dialog');
    await user.type(within(picker).getByRole('searchbox'), 'metroid');
    await waitFor(() => {
      expect(queries.at(-1)).toMatchObject({
        scope: { kind: 'system', systemId: 'snes' },
        text: 'metroid',
      });
    });
    await user.click(await within(picker).findByRole('button', { name: /Super Metroid \(USA\)/ }));
    expect(latest[1]).toEqual({ title: 'Super Metroid', gameId: 42 });
    expect(screen.getByText('In your library')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unlink' }));
    await waitFor(() => {
      expect(latest[1]).toEqual({ title: 'Super Metroid' });
    });
    expect(screen.queryByText('In your library')).toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0] as HTMLElement);
    expect(latest.map((game) => game.title)).toEqual(['Super Metroid']);
  });

  it('FR-MUS-3: Enter in the picker search does not submit the surrounding form', async () => {
    installFakeBridge({
      'library.games.list': () => ok({ total: 0, offset: 0, games: [] }),
    });
    const user = userEvent.setup();
    let submitted = false;
    renderInShell(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = true;
        }}
      >
        <Harness onChange={() => undefined} />
        <button type="submit">Save</button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Link to library game' }));
    const picker = await screen.findByRole('dialog');
    await user.type(within(picker).getByRole('searchbox'), 'metroid{Enter}');
    expect(submitted).toBe(false);
  });
});
