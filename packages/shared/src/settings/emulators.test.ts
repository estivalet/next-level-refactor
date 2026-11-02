import { describe, expect, it } from 'vitest';
import { defaultSettings, SettingsSchema } from './schema.ts';

const EMULATOR_ID = '01900000-0000-7000-8000-000000000001';
const PROFILE_ID = '01900000-0000-7000-8000-000000000002';

function withProfile(profile: Record<string, unknown>, emulator: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
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

  it('FR-EMU-9: a profile defaults to squashfs pass, no entries, no argsFile', () => {
    const profile = SettingsSchema.parse(withProfile({})).profiles[0];
    expect(profile?.squashfs).toBe('pass');
    expect(profile?.entries).toEqual([]);
    expect(profile?.argsFile).toBeUndefined();
  });

  it('FR-EMU-9: mount, entry rules and an args file parse', () => {
    const profile = SettingsSchema.parse(
      withProfile({
        squashfs: 'mount',
        entries: [{ file: '{gameDir}\\{romName}.singe', args: ['-script', '{entry}'] }],
        argsFile: '{gameDir}\\{romName}.commands',
      }),
    ).profiles[0];
    expect(profile?.squashfs).toBe('mount');
    expect(profile?.entries).toHaveLength(1);
  });

  it('FR-EMU-9: pointer extensions default to none; lowercase extensions without dots parse', () => {
    expect(SettingsSchema.parse(withProfile({})).profiles[0]?.pointerExtensions).toEqual([]);
    const profile = SettingsSchema.parse(withProfile({ pointerExtensions: ['m3u', 'xbox360'] }))
      .profiles[0];
    expect(profile?.pointerExtensions).toEqual(['m3u', 'xbox360']);
    expect(issues(withProfile({ pointerExtensions: ['.m3u'] }))[0]?.path).toEqual([
      'profiles',
      0,
      'pointerExtensions',
      0,
    ]);
  });

  it('FR-EMU-9: an entry rule with an unknown token fails on save', () => {
    const bad = withProfile({ entries: [{ file: '{gameDir}\\{nope}', args: ['{entry}'] }] });
    expect(issues(bad)[0]?.path).toEqual(['profiles', 0, 'entries', 0, 'file']);
    const noArgs = withProfile({ entries: [{ file: '{gameDir}\\x', args: [] }] });
    expect(issues(noArgs)[0]?.path).toEqual(['profiles', 0, 'entries', 0, 'args']);
  });

  it('FR-EMU-9: the mount tool defaults to null and must be an absolute .exe', () => {
    expect(SettingsSchema.parse(withProfile({})).tools.squashfsMount).toBeNull();
    expect(
      issues({ ...withProfile({}), tools: { squashfsMount: 'mountsquashfs.exe' } })[0]?.path,
    ).toEqual(['tools', 'squashfsMount']);
  });
});
