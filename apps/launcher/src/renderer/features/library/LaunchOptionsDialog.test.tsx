import {
  defaultSettings,
  EMPTY_LAUNCH_OVERRIDE,
  err,
  ok,
  type EmulatorProfile,
  type LaunchOverride,
  type Settings,
} from '@nextlevel/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../test-utils.tsx';
import { LaunchOptionsDialog } from './LaunchOptionsDialog.tsx';
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

const EMU = '01900000-0000-7000-8000-0000000000e1';
const RA = '01900000-0000-7000-8000-000000000001';
const STANDALONE = '01900000-0000-7000-8000-000000000002';
const SNES_ONLY = '01900000-0000-7000-8000-000000000003';

const profile = (id: string, name: string, args: string[], systems = ['nintendo-64']) =>
  ({ id, name, emulatorId: EMU, systems, args, archives: 'pass', env: {} }) as EmulatorProfile;

const SETTINGS: Settings = {
  ...defaultSettings(),
  emulators: [{ id: EMU, name: 'Emu', executable: 'C:\\emu\\emu.exe' }],
  profiles: [
    profile(RA, 'RetroArch – N64', ['-L', '{core}', '{extraArgs}', '{rom}']),
    profile(STANDALONE, 'Standalone N64', ['{rom}']),
    profile(SNES_ONLY, 'SNES only', ['{rom}'], ['snes']),
  ],
};

const GAME = gameRow(1, 'Homebrew Racer');

function setup(override: LaunchOverride = EMPTY_LAUNCH_OVERRIDE) {
  const bridge = installFakeBridge({
    ...libraryResponses([GAME]),
    'settings.get': () =>
      ok({ kind: 'ok' as const, snapshot: { settings: SETTINGS, revision: 0 } }),
    'library.games.get': () => ok(gameDetails(GAME)),
    'library.games.launchOverride': () => ok(override),
    'library.games.setLaunchOverride': (input) => ok(input.override),
    'launch.running': () => ok(null),
  });
  return bridge;
}

const saved = (bridge: ReturnType<typeof setup>) =>
  bridge.calls
    .filter((c) => c.channel === 'library.games.setLaunchOverride')
    .map((c) => (c.input as { override: LaunchOverride }).override);

describe('LaunchOptionsDialog (FR-EMU-4)', () => {
  it('FR-EMU-4: lists the system default and the profiles covering the system', async () => {
    setup();
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={() => undefined} />);
    const select = await screen.findByRole('combobox', { name: 'Emulator profile' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['System default (RetroArch – N64)', 'RetroArch – N64', 'Standalone N64']);
  });

  it('FR-EMU-4: saving a profile, core and two extra arguments stores them for the game', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const bridge = setup();
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={onClose} />);
    const dialog = await screen.findByRole('dialog', { name: 'Launch options – Homebrew Racer' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Emulator profile' }),
      RA,
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Core' }), 'other_libretro');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Extra arguments' }),
      '--a{Enter}b c{Enter}{Enter}',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(saved(bridge)).toEqual([
      { profileId: RA, core: 'other_libretro', extraArgs: ['--a', 'b c'] },
    ]);
  });

  it('FR-EMU-4: Reset to system default stores empty values', async () => {
    const user = userEvent.setup();
    const bridge = setup({ profileId: STANDALONE, core: 'x', extraArgs: ['--y'] });
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Extra arguments' })).toHaveValue('--y');
    await user.click(within(dialog).getByRole('button', { name: 'Reset to system default' }));
    await waitFor(() => {
      expect(saved(bridge)).toEqual([EMPTY_LAUNCH_OVERRIDE]);
    });
  });

  it('FR-EMU-4: extra arguments with a profile that has no {extraArgs} are flagged', async () => {
    const user = userEvent.setup();
    setup();
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Emulator profile' }),
      STANDALONE,
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Extra arguments' }), '--a');
    expect(
      within(dialog).getByText(/doesn’t use \{extraArgs\}, so these arguments are left out/),
    ).toBeVisible();
  });

  it('FR-EMU-4: a save that main refuses says so and keeps the dialog open', async () => {
    const user = userEvent.setup();
    setup();
    installFakeBridge({
      ...libraryResponses([GAME]),
      'settings.get': () =>
        ok({ kind: 'ok' as const, snapshot: { settings: SETTINGS, revision: 0 } }),
      'library.games.get': () => ok(gameDetails(GAME)),
      'library.games.launchOverride': () => ok(EMPTY_LAUNCH_OVERRIDE),
      'library.games.setLaunchOverride': () => err('VALIDATION_FAILED', 'errors.validationFailed'),
    });
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('The request was not valid.')).toBeVisible();
  });

  it('FR-EMU-4: more than 50 extra arguments can’t be saved, and the dialog says why', async () => {
    const user = userEvent.setup();
    setup();
    renderInShell(<LaunchOptionsDialog gameId={1} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox', { name: 'Extra arguments' });
    await user.click(box);
    await user.paste(Array.from({ length: 51 }, (_, i) => `-a${String(i)}`).join('\n'));
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(dialog).getByText('Use at most 50 extra arguments.')).toBeVisible();
  });

  it('FR-EMU-4: the context menu and the details panel open Launch options', async () => {
    const user = userEvent.setup();
    setup();
    renderInShell(<LibraryApp />);
    const row = await screen.findByRole('option', { name: /Homebrew Racer/ });
    await user.pointer({ keys: '[MouseRight]', target: row });
    await user.click(screen.getByRole('menuitem', { name: 'Launch options…' }));
    expect(await screen.findByRole('dialog', { name: /Launch options/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    const details = within(screen.getByRole('complementary', { name: 'Game details' }));
    await user.click(await details.findByRole('button', { name: 'Launch options…' }));
    expect(await screen.findByRole('dialog', { name: /Launch options/ })).toBeVisible();
  });
});
