import { err, ok, type LaunchLogEntry } from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LaunchLog } from './LaunchLog.tsx';

let height = 480;
beforeEach(() => {
  height = 480;
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function entry(id: number, overrides: Partial<LaunchLogEntry> = {}): LaunchLogEntry {
  return {
    id,
    gameId: 1,
    gameTitle: `Game ${String(id)}`,
    profileId: 'p1',
    profileName: 'RetroArch – N64',
    argv: ['C:\\RA\\retroarch.exe', '-L', 'n64_libretro', 'E:\\roms\\Game (USA).z64'],
    cwd: 'C:\\RA',
    test: false,
    startedAt: '2026-10-21T12:00:00.000Z',
    endedAt: '2026-10-21T12:01:30.000Z',
    exitCode: 0,
    errorCode: null,
    stderrTail: null,
    ...overrides,
  };
}

function setup(entries: LaunchLogEntry[]) {
  return installFakeBridge({
    'launch.log': ({ offset, limit }) =>
      ok({ total: entries.length, offset, entries: entries.slice(offset, offset + limit) }),
  });
}

const logCalls = (bridge: ReturnType<typeof setup>) =>
  bridge.calls
    .filter((c) => c.channel === 'launch.log')
    .map((c) => (c.input as { offset: number }).offset);

describe('LaunchLog (FR-EMU-10)', () => {
  it('FR-EMU-10: rows show the game, profile, duration and outcome; test runs and unfinished runs are marked', async () => {
    setup([
      entry(3, { test: true, exitCode: 2 }),
      entry(2, { endedAt: null, exitCode: null }),
      entry(1, { gameTitle: 'Racer', errorCode: 'LAUNCH_FAILED', exitCode: 1 }),
    ]);
    renderInShell(<LaunchLog />);
    const list = await screen.findByRole('list', { name: 'Launch log' });
    const rows = await within(list).findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByText('Test')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('Exit code 2')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('1:30')).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText('Unknown')).toBeVisible();
    expect(within(rows[2] as HTMLElement).getByText('Racer')).toBeVisible();
    expect(within(rows[2] as HTMLElement).getByText('RetroArch – N64')).toBeVisible();
    expect(within(rows[2] as HTMLElement).getByText('Failed')).toBeVisible();
  });

  it('FR-EMU-10: expanding a row shows its command line, folder and stderr', async () => {
    const user = userEvent.setup();
    setup([entry(1, { stderrTail: 'core crashed' })]);
    renderInShell(<LaunchLog />);
    const toggle = await screen.findByRole('button', { name: /Game 1/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('C:\\RA\\retroarch.exe -L n64_libretro "E:\\roms\\Game (USA).z64"'),
    ).toBeVisible();
    expect(screen.getByText('core crashed')).toBeVisible();
  });

  it('FR-EMU-10: a finished launch refreshes the log', async () => {
    const bridge = setup([entry(1)]);
    renderInShell(<LaunchLog />);
    await screen.findByRole('button', { name: /Game 1/ });
    bridge.emit('launch.finished', {
      launchId: 2,
      gameId: 1,
      exitCode: 0,
      durationMs: 1000,
      counted: true,
    });
    await waitFor(() => {
      expect(logCalls(bridge)).toEqual([0, 0]);
    });
  });

  it('FR-EMU-10: scrolling to the end loads the next page', async () => {
    height = 20_000;
    const bridge = setup(Array.from({ length: 150 }, (_, i) => entry(150 - i)));
    renderInShell(<LaunchLog />);
    await waitFor(() => {
      expect(logCalls(bridge)).toEqual([0, 100]);
    });
    expect(await screen.findByRole('button', { name: /Game 1(?!\d)/ })).toBeInTheDocument();
  });

  it('FR-EMU-10: a log that can’t be read says so instead of looking empty', async () => {
    installFakeBridge({
      'launch.log': () => err('LIBRARY_UNAVAILABLE', 'errors.libraryUnavailable'),
    });
    renderInShell(<LaunchLog />);
    expect(await screen.findByText('The game library could not be opened.')).toBeVisible();
    expect(screen.queryByText('No launches yet.')).toBeNull();
  });

  it('FR-EMU-10: an empty log says so', async () => {
    setup([]);
    renderInShell(<LaunchLog />);
    expect(await screen.findByText('No launches yet.')).toBeVisible();
  });
});
