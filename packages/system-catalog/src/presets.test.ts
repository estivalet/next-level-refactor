import { renderArgs, renderValue, templateIssues, type TokenContext } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  emulatorPresets,
  getPreset,
  getPresetProfile,
  getSystem,
  presetForExecutable,
  systemCatalog,
} from './index.ts';

const ctx: TokenContext = {
  rom: 'E:\\roms\\Sys\\Game (USA).zip',
  romDir: 'E:\\roms\\Sys',
  romName: 'Game (USA)',
  romFile: 'Game (USA).zip',
  romExt: 'zip',
  systemId: 'sys',
  systemDir: 'E:\\roms\\Sys',
  emulatorDir: 'E:\\emu',
  core: 'some_libretro',
  extraArgs: ['--extra'],
  gameDir: 'E:\\roms\\Sys',
  entry: '',
  entryArgs: [],
};

describe('emulator presets (FR-EMU-7)', () => {
  it('FR-EMU-7: the shipped presets are valid and ids are unique', () => {
    const ids = emulatorPresets().flatMap((preset) => preset.profiles.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(emulatorPresets().map((p) => p.id)).toEqual(
      expect.arrayContaining(['retroarch', 'mame', 'dolphin', 'pcsx2', 'duckstation', 'ppsspp']),
    );
  });

  it('FR-EMU-3: every preset template uses only known tokens', () => {
    for (const profile of emulatorPresets().flatMap((preset) => preset.profiles)) {
      for (const arg of profile.args) expect(templateIssues(arg, 'arg'), profile.id).toEqual([]);
    }
  });

  it('FR-EMU-4: every preset profile has {extraArgs}, so a game’s extra arguments reach it', () => {
    for (const profile of emulatorPresets().flatMap((preset) => preset.profiles)) {
      expect(profile.args, profile.id).toContain('{extraArgs}');
    }
  });

  it('FR-EMU-7: every system preset profile exists and covers that system', () => {
    for (const system of systemCatalog()) {
      for (const id of system.presetProfiles) {
        expect(getPresetProfile(id)?.profile.systems, `${system.id} → ${id}`).toContain(system.id);
      }
    }
  });

  it('C2: each preset renders the expected argv (snapshot)', () => {
    const argv = Object.fromEntries(
      emulatorPresets().flatMap((preset) =>
        preset.profiles.map((p) => [p.id, renderArgs(p.args, { ...ctx, core: p.core ?? '' })]),
      ),
    );
    expect(argv).toMatchSnapshot();
  });

  it('FR-EMU-7: an executable name suggests its preset, ignoring case', () => {
    expect(presetForExecutable('RetroArch.EXE')?.id).toBe('retroarch');
    expect(presetForExecutable('pcsx2-qt.exe')?.id).toBe('pcsx2');
    expect(presetForExecutable('notepad.exe')).toBeUndefined();
    expect(getPreset('dolphin')?.name).toBe('Dolphin');
    expect(getPresetProfile('dolphin:default')?.preset.id).toBe('dolphin');
  });

  it('FR-EMU-9: the Script preset runs "FreeFall 3050 A.D.bat" as one quoted cmd argument', () => {
    const script = getPresetProfile('script:default')?.profile;
    if (!script) throw new Error('no script preset');
    const dir = 'E:\\NextLevel\\systems\\VM Labs Nuon';
    const rom = `${dir}\\FreeFall 3050 A.D.bat`;
    const game = { ...ctx, rom, romDir: dir, extraArgs: [] };
    expect(renderArgs(script.args, game)).toEqual(['/d', '/s', '/c', `""${rom}""`]);
    expect(renderValue(script.cwd ?? '', game)).toBe(dir);
  });

  it('FR-EMU-9: Xenia Canary follows Xbox 360 / XBLA pointer files; Xbox 360 lists its .m3u', () => {
    expect(getPresetProfile('xenia-canary:default')?.profile).toMatchObject({
      systems: ['microsoft-xbla', 'microsoft-xbox-360'],
      pointerExtensions: ['m3u', 'xbox360'],
    });
    expect(getSystem('microsoft-xbox-360')?.extensions).toContain('m3u');
    expect(getSystem('microsoft-xbla')?.extensions).toEqual(['xbox360']);
    expect(getPresetProfile('xemu:default')?.profile.pointerExtensions).toBeUndefined();
  });

  it('FR-EMU-9: the Laserdisc systems suggest the Hypseus and Script presets', () => {
    expect(getSystem('singe')?.presetProfiles).toEqual(['hypseus:default']);
    expect(getSystem('daphne')?.presetProfiles).toEqual(['hypseus:daphne']);
    expect(getSystem('vm-labs-nuon')?.presetProfiles).toEqual(['script:default']);
    expect(presetForExecutable('HYPSEUS.EXE')?.id).toBe('hypseus');
  });
});
