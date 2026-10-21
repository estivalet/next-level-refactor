import { describe, expect, it } from 'vitest';
import { defaultSettings, SettingsSchema } from './schema.ts';

const EMULATOR_ID = '01900000-0000-7000-8000-000000000001';
const PROFILE_ID = '01900000-0000-7000-8000-000000000002';

function withProfile(profile: Record<string, unknown>, emulator: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    emulators: [
      { id: EMULATOR_ID, name: 'RetroArch', executable: 'E:\\emu\\ra\\retroarch.exe', ...emulator },
    ],
    profiles: [
      {
        id: PROFILE_ID,
        name: 'RetroArch – N64',
        emulatorId: EMULATOR_ID,
        systems: ['nintendo-64'],
        args: ['-L', '{emulatorDir}/cores/{core}.dll', '{rom}'],
        core: 'mupen64plus_next_libretro',
        ...profile,
      },
    ],
  };
}

function issues(input: unknown) {
  const result = SettingsSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

describe('emulator settings (FR-EMU-2, FR-EMU-4)', () => {
  it('FR-EMU-2: defaults have no emulators or profiles', () => {
    expect(defaultSettings().emulators).toEqual([]);
    expect(defaultSettings().profiles).toEqual([]);
  });

  it('FR-EMU-2: a valid emulator and profile parse with defaults filled in', () => {
    const parsed = SettingsSchema.parse(withProfile({}));
    expect(parsed.profiles[0]).toMatchObject({ archives: 'pass', env: {} });
    expect(parsed.emulators[0]?.name).toBe('RetroArch');
  });

  it('US-D1: an unknown token fails at the argument path', () => {
    expect(issues(withProfile({ args: ['-L', '{romm}'] }))).toEqual([
      { path: ['profiles', 0, 'args', 1], message: 'unknownToken' },
    ]);
  });

  it('FR-EMU-3: cwd and env values are templates too, without {extraArgs}', () => {
    expect(issues(withProfile({ cwd: '{extraArgs}', env: { HOME: '{nope}' } }))).toEqual([
      { path: ['profiles', 0, 'cwd'], message: 'extraArgsAlone' },
      { path: ['profiles', 0, 'env', 'HOME'], message: 'unknownToken' },
    ]);
  });

  it('FR-EMU-2: a profile must name an existing emulator', () => {
    expect(issues(withProfile({ emulatorId: '01900000-0000-7000-8000-0000000000ff' }))).toEqual([
      { path: ['profiles', 0, 'emulatorId'], message: 'unknownEmulator' },
    ]);
  });

  it('FR-EMU-2: the executable is an absolute .exe, .bat or .cmd path', () => {
    expect(issues(withProfile({}, { executable: 'C:\\x\\retroarch' }))).toEqual([
      { path: ['emulators', 0, 'executable'], message: 'notExecutable' },
    ]);
    expect(issues(withProfile({}, { executable: 'retroarch.exe' }))).toEqual([
      { path: ['emulators', 0, 'executable'], message: 'notExecutable' },
    ]);
    expect(issues(withProfile({}, { executable: 'C:\\x\\run.CMD' }))).toEqual([]);
  });

  it('FR-EMU-2: a profile covers at least one valid system id', () => {
    expect(issues(withProfile({ systems: [] }))[0]?.path).toEqual(['profiles', 0, 'systems']);
    expect(issues(withProfile({ systems: ['Nintendo 64'] }))[0]?.path).toEqual([
      'profiles',
      0,
      'systems',
      0,
    ]);
  });

  it('FR-EMU-4: a system default profile that no longer exists still parses', () => {
    const input = {
      ...withProfile({}),
      systems: {
        'nintendo-64': { enabled: true, defaultProfileId: '01900000-0000-7000-8000-0000000000ee' },
      },
    };
    expect(issues(input)).toEqual([]);
  });
});
