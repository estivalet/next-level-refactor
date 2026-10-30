import {
  addEmulator,
  addPresetProfiles,
  defaultSettings,
  emulatorNameFor,
  mergeDuplicateEmulators,
  remainingPresetProfiles,
  removeEmulator,
  removeProfile,
  SettingsSchema,
  type EmulatorProfile,
  type Settings,
} from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { getPreset } from './index.ts';

let counter = 0;
const newId = () => `01900000-0000-7000-8000-${String(++counter).padStart(12, '0')}`;

function enabled(...ids: string[]): Settings {
  return {
    ...defaultSettings(),
    systems: Object.fromEntries(ids.map((id) => [id, { enabled: true }])),
  };
}

const retroarch = () => {
  const preset = getPreset('retroarch');
  if (!preset) throw new Error('no retroarch preset');
  return preset;
};

describe('adding emulators (FR-EMU-2, FR-EMU-7)', () => {
  it('US-D1: a preset emulator gets the preset profiles of the enabled systems', () => {
    const settings = addEmulator(enabled('nintendo-gamecube'), {
      preset: getPreset('dolphin'),
      executable: 'C:\\Emu\\Dolphin.exe',
      newId,
    });
    expect(settings.emulators).toEqual([
      {
        id: expect.any(String) as unknown,
        name: 'Dolphin',
        presetId: 'dolphin',
        executable: 'C:\\Emu\\Dolphin.exe',
      },
    ]);
    expect(settings.profiles).toEqual([
      expect.objectContaining({
        name: 'Dolphin',
        emulatorId: settings.emulators[0]?.id,
        args: ['{extraArgs}', '-b', '-e', '{rom}'],
        presetProfileId: 'dolphin:default',
        archives: 'extract',
        env: {},
      }),
    ]);
    expect(SettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('FR-EMU-7: only preset profiles covering an enabled system are added', () => {
    const settings = addEmulator(enabled('nintendo-64'), {
      preset: retroarch(),
      executable: 'C:\\RA\\retroarch.exe',
      newId,
    });
    expect(settings.profiles.map((p) => p.presetProfileId)).toEqual([
      'retroarch:mupen64plus_next_libretro',
    ]);
    expect(settings.profiles[0]?.core).toBe('mupen64plus_next_libretro');
  });

  it('FR-EMU-2: a custom emulator is named after its file and has no profiles', () => {
    const settings = addEmulator(enabled('nintendo-64'), {
      executable: 'C:\\Emu\\my-emu.exe',
      newId,
    });
    expect(settings.emulators[0]).toMatchObject({
      name: 'my-emu',
      executable: 'C:\\Emu\\my-emu.exe',
    });
    expect(settings.emulators[0]).not.toHaveProperty('presetId');
    expect(settings.profiles).toEqual([]);
  });

  it('emulatorNameFor uses the preset name or the file name', () => {
    expect(emulatorNameFor('C:\\x\\Cemu.exe', getPreset('cemu'))).toBe('Cemu');
    expect(emulatorNameFor('C:\\x\\thing.EXE', undefined)).toBe('thing');
  });

  it('FR-EMU-7: the remaining preset profiles can be added later', () => {
    const settings = addEmulator(enabled('nintendo-64'), {
      preset: retroarch(),
      executable: 'C:\\RA\\retroarch.exe',
      newId,
    });
    const emulatorId = settings.emulators[0]?.id ?? '';
    const remaining = remainingPresetProfiles(retroarch(), emulatorId, settings.profiles);
    expect(remaining.map((p) => p.id)).not.toContain('retroarch:mupen64plus_next_libretro');
    expect(remaining.length).toBe(retroarch().profiles.length - 1);
    const more = addPresetProfiles(
      settings,
      emulatorId,
      [remaining[0]?.id ?? ''],
      retroarch(),
      newId,
    );
    expect(more.profiles).toHaveLength(2);
  });

  it('FR-EMU-2: adding a program already set up adds only its missing profiles to it', () => {
    const first = addEmulator(enabled('nintendo-64'), {
      preset: retroarch(),
      executable: 'C:\\RA\\retroarch.exe',
      newId,
    });
    const again = addEmulator(
      { ...first, systems: { ...first.systems, 'atari-2600': { enabled: true } } },
      { preset: retroarch(), executable: 'c:/ra/RetroArch.exe', newId },
    );
    expect(again.emulators).toEqual(first.emulators);
    expect(again.profiles.map((p) => [p.presetProfileId, p.emulatorId])).toEqual([
      ['retroarch:mupen64plus_next_libretro', first.emulators[0]?.id],
      ['retroarch:stella_libretro', first.emulators[0]?.id],
    ]);
  });
});

describe('merging duplicate emulators', () => {
  /** The same program set up twice, each with the N64 preset profile. */
  function twice(): Settings {
    const one = addEmulator(enabled('nintendo-64'), {
      preset: retroarch(),
      executable: 'C:\\RA\\retroarch.exe',
      newId,
    });
    const otherId = newId();
    const copy = one.profiles[0];
    if (!copy) throw new Error('no profile');
    return {
      ...one,
      emulators: [
        ...one.emulators,
        { ...one.emulators[0], id: otherId, name: 'RetroArch', executable: 'c:/ra/RETROARCH.exe' },
      ],
      profiles: [...one.profiles, { ...copy, id: newId(), emulatorId: otherId }],
    };
  }

  it('keeps one emulator per program and the profile a system default names', () => {
    const settings = twice();
    const [, kept] = settings.profiles;
    const withDefault: Settings = {
      ...settings,
      systems: { 'nintendo-64': { enabled: true, defaultProfileId: kept?.id } },
    };
    const merged = mergeDuplicateEmulators(withDefault);
    expect(merged.emulators).toEqual([settings.emulators[0]]);
    expect(merged.profiles).toEqual([{ ...kept, emulatorId: settings.emulators[0]?.id }]);
    expect(merged.systems['nintendo-64']?.defaultProfileId).toBe(kept?.id);
    expect(SettingsSchema.safeParse(merged).success).toBe(true);
  });

  it('keeps an edited copy of a preset profile on the remaining emulator', () => {
    const settings = twice();
    const edited = { ...settings.profiles[1], args: ['--fullscreen', '{rom}'] } as EmulatorProfile;
    const merged = mergeDuplicateEmulators({
      ...settings,
      profiles: [settings.profiles[0] as EmulatorProfile, edited],
    });
    expect(merged.emulators).toHaveLength(1);
    expect(merged.profiles.map((p) => [p.id, p.emulatorId])).toEqual([
      [settings.profiles[0]?.id, settings.emulators[0]?.id],
      [edited.id, settings.emulators[0]?.id],
    ]);
  });

  it('leaves settings without duplicates unchanged', () => {
    const settings = addEmulator(enabled('nintendo-64'), {
      preset: retroarch(),
      executable: 'C:\\RA\\retroarch.exe',
      newId,
    });
    expect(mergeDuplicateEmulators(settings)).toBe(settings);
  });
});

describe('removing (FR-EMU-4)', () => {
  it('FR-EMU-4: deleting an emulator deletes its profiles and clears system defaults', () => {
    let settings = addEmulator(enabled('nintendo-gamecube'), {
      preset: getPreset('dolphin'),
      executable: 'C:\\Emu\\Dolphin.exe',
      newId,
    });
    const profileId = settings.profiles[0]?.id ?? '';
    settings = {
      ...settings,
      systems: { 'nintendo-gamecube': { enabled: true, defaultProfileId: profileId } },
    };
    const after = removeEmulator(settings, settings.emulators[0]?.id ?? '');
    expect(after.emulators).toEqual([]);
    expect(after.profiles).toEqual([]);
    expect(after.systems['nintendo-gamecube']).toEqual({ enabled: true });
  });

  it('FR-EMU-4: deleting a profile clears the defaults that named it', () => {
    let settings = addEmulator(enabled('nintendo-gamecube'), {
      preset: getPreset('dolphin'),
      executable: 'C:\\Emu\\Dolphin.exe',
      newId,
    });
    const profileId = settings.profiles[0]?.id ?? '';
    settings = {
      ...settings,
      systems: { 'nintendo-gamecube': { enabled: true, defaultProfileId: profileId } },
    };
    const after = removeProfile(settings, profileId);
    expect(after.profiles).toEqual([]);
    expect(after.emulators).toHaveLength(1);
    expect(after.systems['nintendo-gamecube']).toEqual({ enabled: true });
  });
});
