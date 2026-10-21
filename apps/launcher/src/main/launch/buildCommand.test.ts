import { AppErrorException, type Emulator, type EmulatorProfile } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { buildCommand, type CommandInput } from './buildCommand.ts';

const emulator: Emulator = {
  id: '01900000-0000-7000-8000-0000000000e1',
  name: 'RetroArch',
  executable: 'E:\\emu\\ra\\retroarch.exe',
};
const profile: EmulatorProfile = {
  id: '01900000-0000-7000-8000-000000000001',
  name: 'RA',
  emulatorId: emulator.id,
  systems: ['nintendo-64'],
  args: ['-L', '{emulatorDir}\\cores\\{core}.dll', '{extraArgs}', '{rom}'],
  core: 'mupen64plus_next_libretro',
  archives: 'pass',
  env: {},
};
const ROM = 'E:\\roms\\Nintendo 64\\Pokémon & Friends (USA) [!] 100%.z64';

const input = (overrides: Partial<CommandInput> = {}): CommandInput => ({
  emulator,
  profile,
  romPath: ROM,
  systemDir: 'E:\\roms\\Nintendo 64',
  systemId: 'nintendo-64',
  core: 'mupen64plus_next_libretro',
  extraArgs: [],
  baseEnv: {
    PATH: 'C:\\Windows',
    ELECTRON_RUN_AS_NODE: '1',
    NODE_OPTIONS: '--x',
    EMPTY: undefined,
  },
  ...overrides,
});

describe('buildCommand (FR-EMU-3, ADR-004)', () => {
  it('FR-EMU-3: builds the argv array with the executable apart', () => {
    expect(buildCommand(input({ extraArgs: ['--a', 'b c'] }))).toEqual({
      executable: 'E:\\emu\\ra\\retroarch.exe',
      args: ['-L', 'E:\\emu\\ra\\cores\\mupen64plus_next_libretro.dll', '--a', 'b c', ROM],
      cwd: 'E:\\emu\\ra',
      env: { PATH: 'C:\\Windows' },
    });
  });

  it('ADR-004: a ROM path with spaces, &, %, [ and é stays one unchanged element', () => {
    expect(buildCommand(input()).args.at(-1)).toBe(ROM);
  });

  it('FR-EMU-3: every token gets its value', () => {
    const all = {
      ...profile,
      args: ['{romDir}|{romName}|{romFile}|{romExt}|{systemId}|{systemDir}'],
    };
    expect(buildCommand(input({ profile: all })).args).toEqual([
      'E:\\roms\\Nintendo 64|Pokémon & Friends (USA) [!] 100%|Pokémon & Friends (USA) [!] 100%.z64|z64|nintendo-64|E:\\roms\\Nintendo 64',
    ]);
  });

  it('FR-EMU-2: cwd and env come from the profile templates', () => {
    const custom = { ...profile, cwd: '{romDir}', env: { RA_SYSTEM: '{systemId}' } };
    expect(buildCommand(input({ profile: custom }))).toMatchObject({
      cwd: 'E:\\roms\\Nintendo 64',
      env: { PATH: 'C:\\Windows', RA_SYSTEM: 'nintendo-64' },
    });
  });

  it('US-C2: an empty core where the profile uses {core} → CORE_MISSING', () => {
    try {
      buildCommand(input({ core: '' }));
      expect.fail('should throw');
    } catch (error) {
      expect((error as AppErrorException).error).toMatchObject({
        code: 'CORE_MISSING',
        details: { fix: { section: 'emulators', id: profile.id } },
      });
    }
    expect(
      buildCommand(input({ core: '', profile: { ...profile, args: ['{rom}'] } })).args,
    ).toEqual([ROM]);
  });
});
