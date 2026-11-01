import { ok } from '@nextlevel/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { gameDetails, gameRow } from '../library/testing.ts';
import { GameLaunchScreen } from './GameLaunchScreen.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

/** Lets the first `launch.running` answer land, so a later event isn't overwritten by it. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setup(running: { launchId: number; gameId: number } | null) {
  const bridge = installFakeBridge({
    'launch.running': () => ok(running),
    'library.games.get': ({ gameId }) => ok(gameDetails(gameRow(gameId, 'Homebrew Demo'))),
  });
  renderInShell(<GameLaunchScreen />);
  return bridge;
}

const launchScreen = () => screen.queryByRole('status', { name: 'Starting a game' });

describe('GameLaunchScreen (FR-EMU-6, US-C2)', () => {
  it('FR-EMU-6: nothing shows while no game runs', async () => {
    const bridge = setup(null);
    await waitFor(() => {
      expect(bridge.channels()).toContain('launch.running');
    });
    expect(launchScreen()).not.toBeInTheDocument();
  });

  it('FR-EMU-6: covers the launcher from launch.started until launch.finished', async () => {
    const bridge = setup(null);
    await waitFor(() => {
      expect(bridge.channels()).toContain('launch.running');
    });
    await settle();
    bridge.emit('launch.started', { launchId: 4, gameId: 1 });
    expect(await screen.findByRole('status', { name: 'Starting a game' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Homebrew Demo' })).toBeVisible();

    bridge.emit('launch.finished', {
      launchId: 4,
      gameId: 1,
      exitCode: 0,
      durationMs: 60_000,
      counted: true,
    });
    await waitFor(() => {
      expect(launchScreen()).not.toBeInTheDocument();
    });
  });

  it('US-C2: a game already running when the launcher (re)loads shows the screen', async () => {
    setup({ launchId: 4, gameId: 1 });
    expect(await screen.findByRole('heading', { name: 'Homebrew Demo' })).toBeVisible();
    expect(launchScreen()).toBeVisible();
  });
});
