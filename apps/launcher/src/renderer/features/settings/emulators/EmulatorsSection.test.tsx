import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import { EmulatorsSection } from './EmulatorsSection.tsx';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup(overrides: Partial<Settings> = {}, picked = 'C:\\Emu\\Dolphin.exe') {
  const settings: Settings = {
    ...defaultSettings(),
    systems: { 'nintendo-gamecube': { enabled: true }, 'nintendo-64': { enabled: true } },
    ...overrides,
  };
  const bridge = installFakeBridge({
    'systems.catalog': () => ok([...systemCatalog()]),
    'emulators.presets': () => ok([...emulatorPresets()]),
    'settings.get': () => ok({ kind: 'ok' as const, snapshot: { settings, revision: 0 } }),
    'settings.save': (input) => ok({ settings: input.settings, revision: 1 }),
    'app.pickFile': () => ok(picked),
    'app.pickFolder': () => ok('C:\\Emus'),
    'emulators.detect': () =>
      ok([
        { presetId: 'dolphin', executable: 'C:\\Emus\\dolphin\\Dolphin.exe' },
        { presetId: 'retroarch', executable: 'C:\\Emus\\ra\\retroarch.exe' },
      ]),
  });
  renderInShell(<EmulatorsSection />);
  const saved = () => {
    const call = bridge.calls.findLast((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings;
  };
  return { saved };
}

const emulatorList = () => within(screen.getByRole('list', { name: 'Emulators' }));

describe('EmulatorsSection', () => {
  it('US-D1: Add emulator → Dolphin preset → pick Dolphin.exe fills in the profile', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    await user.click(await screen.findByRole('button', { name: 'Add emulator…' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add emulator' }));
    await user.click(dialog.getByRole('radio', { name: 'Dolphin' }));
    await user.click(dialog.getByRole('button', { name: 'Choose program…' }));
    expect(dialog.getByText('C:\\Emu\\Dolphin.exe')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Add' }));

    expect(emulatorList().getByText('C:\\Emu\\Dolphin.exe')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.emulators).toEqual([
      expect.objectContaining({ name: 'Dolphin', presetId: 'dolphin' }),
    ]);
    expect(saved()?.profiles).toEqual([
      expect.objectContaining({
        args: ['-b', '-e', '{rom}'],
        systems: expect.arrayContaining(['nintendo-gamecube']) as unknown,
      }),
    ]);
  });

  it('FR-EMU-7: picking a known program under Custom suggests its preset', async () => {
    const user = userEvent.setup();
    setup({}, 'C:\\RA\\retroarch.exe');
    await user.click(await screen.findByRole('button', { name: 'Add emulator…' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add emulator' }));
    await user.click(dialog.getByRole('button', { name: 'Choose program…' }));
    expect(dialog.getByText('This looks like RetroArch.')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Use the RetroArch preset' }));
    expect(dialog.getByRole('radio', { name: 'RetroArch' })).toBeChecked();
  });

  it('D6: Find emulators in a folder adds the checked ones', async () => {
    const user = userEvent.setup();
    const { saved } = setup();
    await user.click(await screen.findByRole('button', { name: 'Find emulators in a folder…' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Find emulators' }));
    await user.click(dialog.getByRole('button', { name: 'Choose folder…' }));
    expect(await dialog.findByRole('checkbox', { name: /Dolphin\.exe/ })).toBeChecked();
    await user.click(dialog.getByRole('checkbox', { name: /Dolphin\.exe/ }));
    await user.click(dialog.getByRole('button', { name: 'Add 1 emulator' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.emulators.map((e) => e.presetId)).toEqual(['retroarch']);
  });

  it('FR-EMU-4: deleting an emulator asks first and clears the system default', async () => {
    const user = userEvent.setup();
    const emulatorId = '01900000-0000-7000-8000-0000000000e1';
    const profileId = '01900000-0000-7000-8000-000000000001';
    const { saved } = setup({
      emulators: [{ id: emulatorId, name: 'Dolphin', executable: 'C:\\Emu\\Dolphin.exe' }],
      profiles: [
        {
          id: profileId,
          name: 'Dolphin GC',
          emulatorId,
          systems: ['nintendo-gamecube'],
          args: ['{rom}'],
          archives: 'pass',
          env: {},
        },
      ],
      systems: { 'nintendo-gamecube': { enabled: true, defaultProfileId: profileId } },
    });
    expect(await screen.findByText('Dolphin GC')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete Dolphin' }));
    const confirm = within(
      screen.getByRole('dialog', { name: 'Delete Dolphin and its 1 profile?' }),
    );
    await user.click(confirm.getByRole('button', { name: 'Delete Dolphin' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.emulators).toEqual([]);
    expect(saved()?.systems['nintendo-gamecube']).toEqual({ enabled: true });
  });

  it('FR-EMU-7: Add from preset lists the profiles the emulator doesn’t have', async () => {
    const user = userEvent.setup();
    const { saved } = setup({}, 'C:\\RA\\retroarch.exe');
    await user.click(await screen.findByRole('button', { name: 'Add emulator…' }));
    const add = within(screen.getByRole('dialog', { name: 'Add emulator' }));
    await user.click(add.getByRole('radio', { name: 'RetroArch' }));
    await user.click(add.getByRole('button', { name: 'Choose program…' }));
    await user.click(add.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Add from preset…' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add profiles from RetroArch' }));
    await user.type(dialog.getByRole('searchbox', { name: 'Search profiles' }), 'genesis_plus');
    await user.click(dialog.getByRole('checkbox', { name: /genesis_plus_gx/ }));
    await user.click(dialog.getByRole('button', { name: 'Add 1 profile' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.profiles.map((p) => p.presetProfileId)).toEqual([
      'retroarch:mupen64plus_next_libretro',
      'retroarch:genesis_plus_gx_libretro',
    ]);
  });
});
