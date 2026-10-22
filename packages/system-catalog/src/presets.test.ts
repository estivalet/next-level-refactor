import { renderArgs, templateIssues, type TokenContext } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  emulatorPresets,
  getPreset,
  getPresetProfile,
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
});
