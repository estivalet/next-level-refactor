import { ok, type KioskState } from '@nextlevel/shared';
import { resolveTheme } from '@nextlevel/themes';
import { FIXTURE_MENU } from '@nextlevel/themes/testing';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { Desktop } from '../shell/Desktop.tsx';
import { Taskbar } from '../shell/Taskbar.tsx';

// Big Box (the default theme) is swapped for a component the test can make throw.
let mode: 'ok' | 'throw' = 'throw';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function setMode(next: 'ok' | 'throw') {
  act(() => {
    mode = next;
    for (const listener of listeners) listener();
  });
}
function CrashyTheme() {
  const current = useSyncExternalStore(subscribe, () => mode);
  if (current === 'throw') throw new Error('theme broke');
  return <p>theme works</p>;
}

const bigBox = resolveTheme('big-box');
const original = bigBox.Component;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  bigBox.Component = CrashyTheme;
  mode = 'throw';
});
afterEach(() => {
  bigBox.Component = original;
  vi.restoreAllMocks();
  setBridgeForTests(null);
});

const unlocked: KioskState = { enabled: true, locked: false, hide: [], retryAfterMs: 0 };

function setup() {
  const bridge = installFakeBridge({
    'frontend.menu': () => ok(FIXTURE_MENU),
    'launch.running': () => ok(null),
    'app.reportError': () => ok(undefined),
    'kiosk.state': () => ok(unlocked),
  });
  renderInShell(<Desktop taskbar={<Taskbar />} />);
  return bridge;
}

const layer = () => screen.getByTestId('frontend-layer');

async function openFrontend() {
  const u = userEvent.setup();
  await u.click(screen.getByRole('button', { name: 'Start' }));
  const start = screen.getByRole('dialog', { name: 'Start menu' });
  await u.click(within(start).getByRole('button', { name: 'Front-end' }));
  return u;
}

const crashScreen = () => screen.findByRole('alertdialog', { name: 'Theme stopped working' });

describe('a theme that crashes (NFR-REL-2)', () => {
  it('NFR-REL-2: a theme that throws shows Restart theme and reports the crash; nothing is written', async () => {
    const bridge = setup();
    await openFrontend();
    const dialog = await crashScreen();
    expect(within(dialog).getByText(/Your library and settings are safe/)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Restart theme' })).toBeVisible();
    expect(bridge.calls.find((call) => call.channel === 'app.reportError')?.input).toMatchObject({
      where: 'theme',
      id: 'big-box',
      message: 'theme broke',
    });
    const writes = bridge
      .channels()
      .filter((channel) =>
        /^(library\.games\.(set|update|remove)|collections\.|settings\.save)/.test(channel),
      );
    expect(writes).toEqual([]);
  });

  it('NFR-REL-2: Restart theme mounts the theme again', async () => {
    setup();
    const u = await openFrontend();
    const dialog = await crashScreen();
    mode = 'ok';
    await u.click(within(dialog).getByRole('button', { name: 'Restart theme' }));
    expect(await within(layer()).findByText('theme works')).toBeVisible();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('NFR-REL-2: a theme that keeps throwing shows the crash screen again after Restart theme', async () => {
    const bridge = setup();
    const u = await openFrontend();
    await u.click(within(await crashScreen()).getByRole('button', { name: 'Restart theme' }));
    expect(await crashScreen()).toBeVisible();
    await waitFor(() => {
      expect(
        bridge.channels().filter((c) => c === 'app.reportError').length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it('NFR-REL-2: Back to desktop hides the front-end; Switch theme opens the switcher', async () => {
    setup();
    const u = await openFrontend();
    await u.click(within(await crashScreen()).getByRole('button', { name: 'Switch theme' }));
    expect(await screen.findByRole('dialog', { name: 'Switch theme' })).toBeVisible();
    await u.keyboard('{Escape}');
    await u.click(within(await crashScreen()).getByRole('button', { name: 'Back to desktop' }));
    await waitFor(() => {
      expect(layer()).not.toBeVisible();
    });
  });

  it('NFR-REL-2: a locked kiosk hiding the desktop and theme switcher leaves only Restart theme', async () => {
    mode = 'ok';
    const bridge = setup();
    await openFrontend();
    expect(await within(layer()).findByText('theme works')).toBeVisible();
    bridge.emit('kiosk.changed', { ...unlocked, locked: true, hide: ['desktop', 'themeSwitcher'] });
    setMode('throw');
    const dialog = await crashScreen();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Restart theme']);
  });
});
