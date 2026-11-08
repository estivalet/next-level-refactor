import { defaultSettings, ok, type Settings } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBridgeForTests } from '../../../bridge.ts';
import { installFakeBridge, renderInShell } from '../../../test-utils.tsx';
import type { FocusRequest } from '../focusRequest.ts';
import { EmulatorsSection } from './EmulatorsSection.tsx';

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
});
afterEach(() => {
  setBridgeForTests(null);
  vi.restoreAllMocks();
});

function setup(
  overrides: Partial<Settings> = {},
  picked = 'C:\\Emu\\Dolphin.exe',
  focus?: FocusRequest,
) {
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
  renderInShell(<EmulatorsSection {...(focus ? { focus } : {})} />);
  const saved = () => {
    const call = bridge.calls.findLast((c) => c.channel === 'settings.save');
    return (call?.input as { settings: Settings } | undefined)?.settings;
  };
  return { saved };
}

const emulatorList = () => within(screen.getByRole('list', { name: 'Emulators' }));
const shownEmulator = (name: string) => within(screen.getByRole('region', { name }));

const E = (n: number) => `01900000-0000-7000-8000-0000000000e${String(n)}`;
const P = (n: number) => `01900000-0000-7000-8000-00000000${String(n).padStart(4, '0')}`;
function profile(n: number, name: string, emulatorId: string): Settings['profiles'][number] {
  return {
    id: P(n),
    name,
    emulatorId,
    systems: ['nintendo-64'],
    args: ['{rom}'],
    archives: 'pass',
    squashfs: 'pass',
    entries: [],
    pointerExtensions: [],
    env: {},
  };
}
const many: Partial<Settings> = {
  emulators: [
    { id: E(1), name: 'ScummVM', executable: 'C:\\Emu\\scummvm.exe' },
    { id: E(2), name: 'MAME', executable: 'C:\\Emu\\mame.exe' },
    { id: E(3), name: 'dolphin', executable: 'C:\\Emu\\Dolphin.exe' },
  ],
  profiles: [
    profile(1, 'MAME – Jupiter Ace', E(2)),
    profile(2, 'MAME – Intec InterAct', E(2)),
    profile(3, 'ScummVM', E(1)),
  ],
};

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

    expect(emulatorList().getByRole('button', { name: /Dolphin/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(shownEmulator('Dolphin').getByText('C:\\Emu\\Dolphin.exe')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved()?.emulators).toEqual([
      expect.objectContaining({ name: 'Dolphin', presetId: 'dolphin' }),
    ]);
    expect(saved()?.profiles).toEqual([
      expect.objectContaining({
        args: ['{extraArgs}', '-b', '-e', '{rom}'],
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
          squashfs: 'pass',
          entries: [],
          pointerExtensions: [],
          env: {},
        },
      ],
      systems: { 'nintendo-gamecube': { enabled: true, defaultProfileId: profileId } },
    });
    expect(await screen.findByText('Dolphin GC')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'More for Dolphin' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Dolphin' }));
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
    await user.click(screen.getByRole('button', { name: 'Add profile' }));
    await user.click(screen.getByRole('menuitem', { name: 'From preset…' }));
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

  it('FR-EMU-9: the mount tool path can be chosen and cleared; empty says where it is looked for', async () => {
    const user = userEvent.setup();
    const { saved } = setup({}, 'D:\\Tools\\mountsquashfs.exe');
    const tool = await screen.findByRole('group', { name: 'squashfs mount tool' });
    expect(within(tool).getByText(/NextLevel tools folder/)).toBeVisible();
    await user.click(within(tool).getByRole('button', { name: 'Choose…' }));
    expect(await within(tool).findByText('D:\\Tools\\mountsquashfs.exe')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => {
      expect(saved()?.tools.squashfsMount).toBe('D:\\Tools\\mountsquashfs.exe');
    });
    await user.click(within(tool).getByRole('button', { name: 'Clear' }));
    expect(within(tool).getByText(/NextLevel tools folder/)).toBeVisible();
  });
  it('FR-EMU-2: emulators are listed A–Z and the first is shown', async () => {
    setup(many);
    const list = await screen.findByRole('list', { name: 'Emulators' });
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['dolphin0', 'MAME2', 'ScummVM1']);
    expect(shownEmulator('dolphin').getByText('C:\\Emu\\Dolphin.exe')).toBeVisible();
  });

  it('FR-EMU-2: the emulator search filters the list; picking one shows its profiles A–Z', async () => {
    const user = userEvent.setup();
    setup(many);
    await user.type(await screen.findByRole('searchbox', { name: 'Find emulator' }), 'ma');
    expect(emulatorList().getAllByRole('button')).toHaveLength(1);
    await user.click(emulatorList().getByRole('button', { name: /MAME/ }));
    const profiles = within(screen.getByRole('list', { name: 'Profiles of MAME' }));
    expect(profiles.getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      'Intec InterAct1 system',
      'Jupiter Ace1 system',
    ]);
    await user.type(screen.getByRole('searchbox', { name: 'Filter profiles' }), 'jupiter');
    expect(profiles.getAllByRole('listitem')).toHaveLength(1);
    await user.type(screen.getByRole('searchbox', { name: 'Find emulator' }), 'zzz');
    expect(screen.getByText('No emulator matches.')).toBeVisible();
  });

  it('FR-EMU-2: editing a profile replaces the list; Back returns to the emulator', async () => {
    const user = userEvent.setup();
    setup(many);
    await user.click(await screen.findByRole('button', { name: /MAME/ }));
    await user.click(screen.getByRole('button', { name: 'Edit MAME – Jupiter Ace' }));
    expect(screen.getByRole('region', { name: 'Edit profile' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Profiles of MAME' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back to MAME' }));
    expect(screen.getByRole('list', { name: 'Profiles of MAME' })).toBeVisible();
  });

  it('FR-EMU-2: an emulator whose profile has a problem is marked Needs attention', async () => {
    setup({
      ...many,
      profiles: [
        { ...profile(1, 'MAME – Jupiter Ace', E(2)), args: ['{romm}'] },
        profile(3, 'ScummVM', E(1)),
      ],
    });
    await screen.findByRole('list', { name: 'Emulators' });
    expect(
      emulatorList()
        .getAllByLabelText('Needs attention')
        .map((icon) => icon.closest('button')?.textContent),
    ).toEqual(['MAME1']);
  });

  it('US-C2: Fix in Settings opens the profile under its emulator', async () => {
    setup(many, undefined, { id: P(3), n: 1 });
    expect(await screen.findByRole('region', { name: 'Edit profile' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back to ScummVM' })).toBeVisible();
    expect(emulatorList().getByRole('button', { name: /ScummVM/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
