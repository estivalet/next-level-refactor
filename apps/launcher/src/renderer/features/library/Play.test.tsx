import { err, ok, type GameRow } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { useShell } from '../shell/ShellContext.tsx';
import { LibraryApp } from './LibraryApp.tsx';
import { gameDetails, gameRow, libraryResponses } from './testing.ts';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const GAMES: GameRow[] = [
  gameRow(1, 'Homebrew Demo'),
  gameRow(2, 'Homebrew Racer'),
  gameRow(3, 'Lost Game', { missing: true, expectedPath: 'E:\\roms\\Lost Game.z64' }),
];

/** Shows the shell's windows, so a test can see which app "Fix in Settings" opened. */
function WindowsProbe() {
  const { state } = useShell();
  return (
    <output aria-label="windows">
      {JSON.stringify(state.windows.map((w) => ({ appId: w.appId, params: w.params })))}
    </output>
  );
}

function setup(responses: FakeResponses = {}) {
  let plays = 0;
  const bridge = installFakeBridge({
    ...libraryResponses(GAMES),
    'launch.running': () => ok(null),
    'launch.game': () => ok({ launchId: 10 }),
    'library.games.get': ({ gameId }) => {
      const row = GAMES.find((game) => game.id === gameId) ?? gameRow(gameId, 'Unknown');
      return ok(gameDetails(row, { playCount: gameId === 1 ? plays : 0 }));
    },
    ...responses,
  });
  renderInShell(
    <>
      <LibraryApp />
      <WindowsProbe />
    </>,
  );
  return {
    bridge,
    countPlay: () => {
      plays += 1;
    },
  };
}

const details = () => within(screen.getByRole('complementary', { name: 'Game details' }));

async function selectDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('option', { name: /Homebrew Demo/ }));
  await details().findByRole('heading', { name: 'Homebrew Demo' });
}

describe('Play from the Library (FR-EMU-6, US-C2)', () => {
  it('US-C2: Play in the details panel launches the selected game', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    await selectDemo(user);
    await user.click(details().getByRole('button', { name: 'Play' }));
    const call = bridge.calls.find((c) => c.channel === 'launch.game');
    expect(call?.input).toEqual({ gameId: 1 });
  });

  it('US-C2: Play is disabled for a missing game', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('option', { name: /Lost Game/ }));
    await details().findByRole('heading', { name: 'Lost Game' });
    expect(details().getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('US-C2: Enter and double-click on a row play it', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    await user.click(await screen.findByRole('option', { name: /Homebrew Racer/ }));
    await user.keyboard('{Enter}');
    await user.dblClick(screen.getByRole('option', { name: /Homebrew Demo/ }));
    const played = bridge.calls
      .filter((c) => c.channel === 'launch.game')
      .map((c) => (c.input as { gameId: number }).gameId);
    expect(played).toEqual([2, 1]);
  });

  it('US-C2: Enter and double-click play a search result', async () => {
    const user = userEvent.setup();
    const { bridge } = setup({
      'library.search': () =>
        ok({ games: [GAMES[1] as GameRow, GAMES[0] as GameRow], more: false }),
    });
    await user.type(await screen.findByRole('searchbox', { name: 'Search all games' }), 'home');
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    await user.dblClick(await within(results).findByRole('option', { name: /Homebrew Racer/ }));
    await user.click(within(results).getByRole('option', { name: /Homebrew Demo/ }));
    await user.keyboard('{Enter}');
    const played = bridge.calls
      .filter((c) => c.channel === 'launch.game')
      .map((c) => (c.input as { gameId: number }).gameId);
    expect(played).toEqual([2, 1]);
  });

  it('US-C2: Enter on a missing game does not launch it', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    await user.click(await screen.findByRole('option', { name: /Lost Game/ }));
    await user.keyboard('{Enter}');
    expect(bridge.channels()).not.toContain('launch.game');
  });

  it('US-C2: the context menu has Play', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    await user.pointer({
      keys: '[MouseRight]',
      target: await screen.findByRole('option', { name: /Homebrew Racer/ }),
    });
    await user.click(screen.getByRole('menuitem', { name: 'Play' }));
    expect(bridge.calls.find((c) => c.channel === 'launch.game')?.input).toEqual({ gameId: 2 });
  });

  it('D4: while a game runs the Library says so and Play is off; afterwards the play count shows', async () => {
    const user = userEvent.setup();
    const { bridge, countPlay } = setup();
    await selectDemo(user);
    await user.click(details().getByRole('button', { name: 'Play' }));
    bridge.emit('launch.started', { launchId: 10, gameId: 1 });
    expect(await screen.findByText('Playing Homebrew Demo…')).toBeVisible();
    expect(details().getByRole('button', { name: 'Play' })).toBeDisabled();
    countPlay();
    bridge.emit('launch.finished', {
      launchId: 10,
      gameId: 1,
      exitCode: 0,
      durationMs: 60_000,
      counted: true,
    });
    await waitFor(() => {
      expect(screen.queryByText('Playing Homebrew Demo…')).not.toBeInTheDocument();
    });
    expect(await details().findByText('Played 1 time')).toBeVisible();
    expect(screen.getByRole('option', { name: /Homebrew Demo/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('listbox', { name: 'Games' })).toHaveFocus();
  });

  it('D4: a game already running when the Library opens shows as playing', async () => {
    setup({ 'launch.running': () => ok({ launchId: 4, gameId: 2 }) });
    expect(await screen.findByText('Playing Homebrew Racer…')).toBeVisible();
  });

  it('US-C2: NO_PROFILE opens the error dialog, and Fix in Settings opens Systems for it', async () => {
    const user = userEvent.setup();
    setup({
      'launch.game': () =>
        err('NO_PROFILE', 'errors.noProfile', {
          fix: { section: 'systems', id: 'nintendo-64' },
        }),
    });
    await selectDemo(user);
    await user.click(details().getByRole('button', { name: 'Play' }));
    const dialog = await screen.findByRole('dialog', { name: 'Homebrew Demo didn’t start' });
    expect(within(dialog).getByText('No emulator is set up for this system.')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Fix in Settings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(screen.getByRole('status', { name: 'windows' }).textContent)).toEqual([
      { appId: 'settings', params: { section: 'systems', focusId: 'nintendo-64' } },
    ]);
  });

  it('US-C2: a failure for a game whose details can’t be read still has a title', async () => {
    const { bridge } = setup({
      'library.games.get': () => err('NOT_FOUND', 'errors.notFound'),
    });
    await screen.findByRole('option', { name: /Homebrew Demo/ });
    bridge.emit('launch.finished', {
      launchId: 10,
      gameId: 1,
      exitCode: 2,
      durationMs: 300,
      counted: false,
      error: { code: 'LAUNCH_FAILED', message: 'errors.launchFailed' },
    });
    expect(await screen.findByRole('dialog', { name: 'The game didn’t start' })).toBeVisible();
  });

  it('US-C2: ALREADY_RUNNING shows its message without a fix link', async () => {
    const user = userEvent.setup();
    setup({ 'launch.game': () => err('ALREADY_RUNNING', 'errors.alreadyRunning') });
    await selectDemo(user);
    await user.click(details().getByRole('button', { name: 'Play' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('A game is already running.')).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: 'Fix in Settings' })).toBeNull();
  });

  it('D5: a run that failed shows the exit code and the emulator’s stderr', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    await selectDemo(user);
    await user.click(details().getByRole('button', { name: 'Play' }));
    bridge.emit('launch.started', { launchId: 10, gameId: 1 });
    bridge.emit('launch.finished', {
      launchId: 10,
      gameId: 1,
      exitCode: 2,
      durationMs: 300,
      counted: false,
      error: {
        code: 'LAUNCH_FAILED',
        message: 'errors.launchFailed',
        details: { exitCode: 2, stderrTail: 'missing BIOS', fix: { section: 'emulators' } },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Homebrew Demo didn’t start' });
    expect(within(dialog).getByText('Exit code 2')).toBeVisible();
    expect(within(dialog).getByText('missing BIOS')).toBeVisible();
  });
});
