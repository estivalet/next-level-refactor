import { defaultSettings, ok, type Settings, type TestLaunchResult } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { gameRow } from '../../library/testing.ts';
import { EmulatorsSection } from './EmulatorsSection.tsx';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

const EMULATOR = '01900000-0000-7000-8000-0000000000e1';
const PROFILE = '01900000-0000-7000-8000-000000000001';
const RESULT: TestLaunchResult = {
  executable: 'C:\\RA\\retroarch.exe',
  args: ['C:\\roms\\Racer.z64'],
  cwd: 'C:\\RA',
  commandLine: 'C:\\RA\\retroarch.exe C:\\roms\\Racer.z64',
  exitCode: 2,
  stderrTail: 'core crashed',
  durationMs: 1500,
};

function setup(testResult: TestLaunchResult = RESULT) {
  const settings: Settings = {
    ...defaultSettings(),
    emulators: [{ id: EMULATOR, name: 'RetroArch', executable: 'C:\\RA\\retroarch.exe' }],
    profiles: [
      {
        id: PROFILE,
        name: 'RA N64',
        emulatorId: EMULATOR,
        systems: ['nintendo-64'],
        args: ['-L', '{rom}'],
        archives: 'pass',
        env: {},
      },
    ],
  };
  const bridge = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'emulators.presets': () => ok([...emulatorPresets()]),
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    'launch.preview': () =>
      ok({ executable: 'x', args: [], cwd: 'x', commandLine: 'C:\\RA\\retroarch.exe -L PREVIEW' }),
    'library.search': () => ok({ games: [gameRow(7, 'Racer')], more: false }),
    'launch.test': () => ok(testResult),
  });
  renderInShell(<EmulatorsSection />);
  return { bridge };
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Edit RA N64' }));
  return within(screen.getByRole('region', { name: 'Edit profile' }));
}

describe('ProfileEditor (FR-EMU-3, FR-EMU-5, US-D1)', () => {
  it('US-D1: an unknown token is named under the field and Save is disabled', async () => {
    const user = userEvent.setup();
    setup();
    const editor = await openEditor(user);
    const arg = editor.getByRole('textbox', { name: 'Argument 2' });
    await user.clear(arg);
    await user.type(arg, '{{romm}');
    expect(editor.getByText('Unknown token {romm}')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('FR-EMU-3: typing { offers tokens and picking one inserts it', async () => {
    const user = userEvent.setup();
    setup();
    const editor = await openEditor(user);
    await user.click(editor.getByRole('button', { name: 'Add argument' }));
    await user.type(editor.getByRole('textbox', { name: 'Argument 3' }), '{{romD');
    await user.click(editor.getByRole('option', { name: '{romDir}' }));
    expect(editor.getByRole('textbox', { name: 'Argument 3' })).toHaveValue('{romDir}');
  });

  it('FR-EMU-5: the editor shows the command preview from main', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    const editor = await openEditor(user);
    expect(await editor.findByText('C:\\RA\\retroarch.exe -L PREVIEW')).toBeVisible();
    expect(bridge.channels()).toContain('launch.preview');
  });

  it('FR-EMU-5: Test launch with a chosen game shows command, exit code and stderr', async () => {
    const user = userEvent.setup();
    const { bridge } = setup();
    const editor = await openEditor(user);
    expect(editor.getByRole('button', { name: 'Test launch' })).toBeDisabled();
    await user.type(editor.getByRole('searchbox', { name: 'Search a game' }), 'rac');
    await user.click(await editor.findByRole('button', { name: /Racer/ }));
    await user.click(editor.getByRole('button', { name: 'Test launch' }));
    expect(await editor.findByText('Exit code 2')).toBeVisible();
    expect(editor.getByText('core crashed')).toBeVisible();
    expect(editor.getByText('C:\\RA\\retroarch.exe C:\\roms\\Racer.z64')).toBeVisible();
    const call = bridge.calls.find((c) => c.channel === 'launch.test');
    expect(call?.input).toMatchObject({ gameId: 7, profile: { id: PROFILE } });
  });

  it('FR-EMU-5: a Test launch error shows its message', async () => {
    const user = userEvent.setup();
    setup({
      ...RESULT,
      exitCode: null,
      stderrTail: '',
      error: { code: 'EMULATOR_MISSING', message: 'errors.emulatorMissing' },
    });
    const editor = await openEditor(user);
    await user.type(editor.getByRole('searchbox', { name: 'Search a game' }), 'rac');
    await user.click(await editor.findByRole('button', { name: /Racer/ }));
    await user.click(editor.getByRole('button', { name: 'Test launch' }));
    expect(await editor.findByText(/The emulator could not be found/)).toBeVisible();
  });

  it('FR-EMU-2: a new profile needs a system before it can be saved', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('button', { name: 'New profile' }));
    const editor = within(screen.getByRole('region', { name: 'Edit profile' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(editor.getByRole('searchbox', { name: 'Search systems' }), 'saturn');
    await user.click(editor.getByRole('checkbox', { name: 'Sega Saturn' }));
    expect(editor.getByText('1 system selected')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
