import { err, ok } from '@nextlevel/shared';
import { FakeThemeHost, FIXTURE_MENU } from '@nextlevel/themes/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell, type FakeResponses } from '../../test-utils.tsx';
import { Desktop } from '../shell/Desktop.tsx';
import { useShell } from '../shell/ShellContext.tsx';
import { Taskbar } from '../shell/Taskbar.tsx';

afterEach(() => {
  setBridgeForTests(null);
});

const NO_ART = { packFiles: [], assetsFiles: [], manifest: null, warnings: [] };

function WindowsProbe() {
  const { state } = useShell();
  return <output aria-label="windows">{state.windows.map((w) => w.appId).join(',')}</output>;
}

function setup(responses: FakeResponses = {}) {
  const games = new FakeThemeHost();
  const bridge = installFakeBridge({
    'frontend.menu': () => ok(FIXTURE_MENU),
    'frontend.games': async ({ nodeId }) => ok(await games.getGames(nodeId)),
    'frontend.artIndex': () => ok(NO_ART),
    'launch.running': () => ok(null),
    'launch.game': () => ok({ launchId: 1 }),
    'library.games.get': () => ok({ description: null } as never),
    ...responses,
  });
  renderInShell(
    <>
      <Desktop taskbar={<Taskbar />} />
      <WindowsProbe />
    </>,
  );
  return bridge;
}

const layer = () => screen.getByTestId('frontend-layer');
const card = () => layer().querySelector('.bigbox-card') as HTMLElement;

/** A full key press on whatever has focus, the way the input layer reads keys. */
function press(code: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { code });
  fireEvent.keyUp(target, { code });
}

async function openFromStart() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  const start = screen.getByRole('dialog', { name: 'Start menu' });
  fireEvent.click(within(start).getByRole('button', { name: 'Front-end' }));
  await waitFor(() => {
    expect(card()).toHaveTextContent('Nintendo');
  });
  await waitFor(() => {
    expect(layer().contains(document.activeElement)).toBe(true);
  });
}

/** Root → Nintendo → Nintendo 64. */
async function openN64() {
  await openFromStart();
  press('Enter');
  await waitFor(() => {
    expect(card()).toHaveTextContent('Super Nintendo');
  });
  press('ArrowRight');
  press('Enter');
  await waitFor(() => {
    expect(card()).toHaveTextContent('N64 A');
  });
}

describe('front-end mode (FR-THM-1, FR-THM-3)', () => {
  it('Start → Front-end opens the theme fullscreen with input on the theme', async () => {
    setup();
    await openFromStart();
    expect(layer()).toBeVisible();
    expect(screen.getByRole('main', { hidden: true })).toHaveAttribute('inert');
  });

  it('FR-THM-3: M goes to the desktop and the taskbar entry restores the same focus', async () => {
    setup();
    await openFromStart();
    press('Enter');
    press('ArrowRight');
    await waitFor(() => {
      expect(card()).toHaveTextContent('Nintendo 64');
    });
    press('KeyM');
    await waitFor(() => {
      expect(layer()).not.toBeVisible();
    });
    expect(screen.getByRole('main')).not.toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Front-end' }));
    await waitFor(() => {
      expect(layer()).toBeVisible();
    });
    expect(card()).toHaveTextContent('Nintendo 64');
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
  });

  it('US-C1: View+Start on a gamepad comes back from the desktop too', async () => {
    let pressed: number[] = [];
    const pad = () => ({
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: 0 })),
    });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad()], configurable: true });
    try {
      setup();
      await openFromStart();
      press('KeyM');
      await waitFor(() => {
        expect(layer()).not.toBeVisible();
      });
      pressed = [8, 9];
      await waitFor(() => {
        expect(layer()).toBeVisible();
      });
    } finally {
      Reflect.deleteProperty(navigator, 'getGamepads');
    }
  });

  it('back at the root opens the theme menu: Resume returns, Desktop leaves', async () => {
    setup();
    await openFromStart();
    press('Escape');
    const menu = await screen.findByRole('dialog', { name: 'Theme menu' });
    press('ArrowDown');
    press('ArrowDown'); // Desktop · Switch theme · Resume
    press('Enter');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Theme menu' })).toBeNull();
    });
    expect(menu).not.toBeInTheDocument();
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
    press('Tab');
    await screen.findByRole('dialog', { name: 'Theme menu' });
    press('Enter');
    await waitFor(() => {
      expect(layer()).not.toBeVisible();
    });
  });
});

describe('theme switcher (FR-THM-1)', () => {
  const focusedRow = () => layer().querySelector('.bbl-row--focused')?.textContent ?? null;

  it('T switches theme in place: same level, same focused game, lastUsed saved', async () => {
    const bridge = setup();
    await openN64();
    press('ArrowRight');
    await waitFor(() => {
      expect(card()).toHaveTextContent('N64 B');
    });
    press('KeyT');
    const switcher = await screen.findByRole('dialog', { name: 'Switch theme' });
    expect(within(switcher).getAllByRole('button')).toHaveLength(4);
    press('ArrowRight');
    press('Enter');
    await waitFor(() => {
      expect(layer()).toHaveAttribute('data-theme', 'big-box-list');
    });
    await waitFor(() => {
      expect(focusedRow()).toBe('N64 B');
    });
    expect(screen.queryByRole('dialog', { name: 'Switch theme' })).toBeNull();
    expect(bridge.calls).toContainEqual({
      channel: 'frontend.themeOpened',
      input: { themeId: 'big-box-list' },
    });
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
    press('ArrowDown');
    expect(focusedRow()).toBe('N64 C');
  });

  it('T over the key help, then back: the help has the keyboard again, and closes', async () => {
    setup();
    await openFromStart();
    press('F1');
    const help = await screen.findByRole('dialog', { name: 'Controls' });
    press('KeyT');
    await screen.findByRole('dialog', { name: 'Switch theme' });
    press('Escape');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Switch theme' })).toBeNull();
    });
    await waitFor(() => {
      expect(help.contains(document.activeElement)).toBe(true);
    });
    press('Escape');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Controls' })).toBeNull();
    });
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
  });

  it('the theme menu offers Switch theme; back closes the switcher on the same theme', async () => {
    setup();
    await openFromStart();
    press('Escape');
    const menu = await screen.findByRole('dialog', { name: 'Theme menu' });
    fireEvent.click(within(menu).getByRole('button', { name: /Switch theme/ }));
    await screen.findByRole('dialog', { name: 'Switch theme' });
    press('Escape');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Switch theme' })).toBeNull();
    });
    expect(layer()).toHaveAttribute('data-theme', 'big-box');
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
  });
});

describe('front-end play (US-C2)', () => {
  it('input pauses while the game runs and comes back focused on the same game', async () => {
    const bridge = setup();
    await openN64();
    press('Enter');
    await waitFor(() => {
      expect(bridge.calls.filter((c) => c.channel === 'launch.game')).toHaveLength(1);
    });
    bridge.emit('launch.started', { launchId: 1, gameId: 11 });
    expect(await screen.findByRole('status', { name: 'Playing' })).toBeInTheDocument();
    press('ArrowRight');
    expect(card()).toHaveTextContent('N64 A');
    bridge.emit('launch.finished', {
      launchId: 1,
      gameId: 11,
      exitCode: 0,
      durationMs: 60_000,
      counted: true,
    });
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Playing' })).toBeNull();
    });
    await waitFor(() => {
      expect(layer().contains(document.activeElement)).toBe(true);
    });
    expect(card()).toHaveTextContent('N64 A');
    press('ArrowRight');
    await waitFor(() => {
      expect(card()).toHaveTextContent('N64 B');
    });
  });

  it('between Play and the game starting, input waits: no second launch, no leaving', async () => {
    const bridge = setup({ 'launch.game': () => new Promise(() => undefined) });
    await openN64();
    press('Enter');
    expect(await screen.findByRole('status', { name: 'Playing' })).toBeInTheDocument();
    press('Enter');
    press('KeyM');
    expect(bridge.calls.filter((c) => c.channel === 'launch.game')).toHaveLength(1);
    expect(layer()).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    bridge.emit('launch.started', { launchId: 1, gameId: 11 });
    bridge.emit('launch.finished', {
      launchId: 1,
      gameId: 11,
      exitCode: 0,
      durationMs: 60_000,
      counted: true,
    });
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Playing' })).toBeNull();
    });
  });

  it('a launch error shows its reason; Fix in Settings goes to the desktop and opens Settings', async () => {
    setup({
      'launch.game': () =>
        err('EMULATOR_MISSING', 'errors.emulatorMissing', {
          fix: { section: 'emulators' },
        }),
    });
    await openN64();
    press('Enter');
    const dialog = await screen.findByRole('dialog', { name: /didn’t start/ });
    expect(within(dialog).getByText(/emulator/i)).toBeInTheDocument();
    press('Enter');
    await waitFor(() => {
      expect(layer()).not.toBeVisible();
    });
    expect(screen.getByRole('status', { name: 'windows', hidden: true })).toHaveTextContent(
      'settings',
    );
  });

  it('a game that exits with an error shows the reason; back closes it', async () => {
    const bridge = setup();
    await openN64();
    press('Enter');
    bridge.emit('launch.started', { launchId: 1, gameId: 11 });
    bridge.emit('launch.finished', {
      launchId: 1,
      gameId: 11,
      exitCode: 3,
      durationMs: 500,
      counted: false,
      error: { code: 'LAUNCH_FAILED', message: 'errors.launchFailed', details: { exitCode: 3 } },
    });
    const dialog = await screen.findByRole('dialog', { name: /didn’t start/ });
    expect(dialog).toHaveTextContent('3');
    press('Escape');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /didn’t start/ })).toBeNull();
    });
  });
});
