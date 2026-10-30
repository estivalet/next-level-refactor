import { defaultSettings, SettingsSchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { emulatorForSystem } from './emulatorForSystem.ts';

let n = 0;
const newId = () => `0192f000-0000-7000-8000-${String((n += 1)).padStart(12, '0')}`;
const covers = (settings: { profiles: Array<{ systems: string[] }> }, systemId: string) =>
  settings.profiles.some((profile) => profile.systems.includes(systemId));

describe('Locate emulator (US-B1, D48)', () => {
  it('a system nobody enabled (a catalog install) ends up enabled and covered', () => {
    const result = emulatorForSystem(
      defaultSettings(),
      'nintendo-nes',
      'C:\\Emu\\retroarch.exe',
      newId,
    );
    if (!('settings' in result)) throw new Error('refused');
    expect(result.settings.systems['nintendo-nes']?.enabled).toBe(true);
    expect(covers(result.settings, 'nintendo-nes')).toBe(true);
    expect(result.settings.emulators).toHaveLength(1);
  });

  it('a program already set up gets the missing profiles, not a second emulator', () => {
    const first = emulatorForSystem(
      defaultSettings(),
      'nintendo-nes',
      'C:\\Emu\\retroarch.exe',
      newId,
    );
    if (!('settings' in first)) throw new Error('refused');
    const second = emulatorForSystem(
      first.settings,
      'nintendo-snes',
      'c:\\emu\\RetroArch.exe',
      newId,
    );
    if (!('settings' in second)) throw new Error('refused');
    expect(second.settings.emulators).toHaveLength(1);
    expect(covers(second.settings, 'nintendo-snes')).toBe(true);
  });

  it('an unknown program is saved without a preset (arguments: the ROM token only)', () => {
    const result = emulatorForSystem(
      defaultSettings(),
      'nintendo-nes',
      'C:\\Emu\\Mesen.exe',
      newId,
    );
    if (!('settings' in result)) throw new Error('refused');
    expect(result.settings.emulators).toHaveLength(1);
    expect(result.settings.emulators[0]?.presetId).toBeUndefined();
    expect(result.settings.profiles).toHaveLength(1);
    expect(result.settings.profiles[0]).toMatchObject({
      emulatorId: result.settings.emulators[0]?.id,
      systems: ['nintendo-nes'],
      args: ['{rom}'],
    });
    expect(result.settings.systems['nintendo-nes']?.enabled).toBe(true);
    expect(SettingsSchema.safeParse(result.settings).success).toBe(true);
  });

  it('a known program that does not play the system is refused, nothing saved', () => {
    expect(
      emulatorForSystem(defaultSettings(), 'nintendo-nes', 'C:\\Emu\\pcsx2-qt.exe', newId),
    ).toEqual({
      refused: 'doesNotPlay',
    });
  });
});
