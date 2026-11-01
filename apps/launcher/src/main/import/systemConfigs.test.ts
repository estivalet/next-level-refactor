import { SettingsSchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { addSystemConfigs, type SystemConfig } from './systemConfigs.ts';

let n = 0;
const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
const RA = '01900000-0000-7000-8000-0000000000e1';
const MAME = '01900000-0000-7000-8000-0000000000e2';
const FUSE = '01900000-0000-7000-8000-0000000000f1';
const MAME_PROFILE = '01900000-0000-7000-8000-0000000000f2';

function settings() {
  return SettingsSchema.parse({
    schemaVersion: 2,
    systems: {
      'sinclair-zx-spectrum': { enabled: true, defaultProfileId: FUSE },
      'acorn-atom': { enabled: true },
    },
    emulators: [
      { id: RA, name: 'RetroArch', presetId: 'retroarch', executable: 'E:\\RA\\retroarch.exe' },
      { id: MAME, name: 'MAME', presetId: 'mame', executable: 'E:\\MAME\\mame.exe' },
    ],
    profiles: [
      {
        id: FUSE,
        name: 'RetroArch – fuse',
        emulatorId: RA,
        systems: ['sinclair-zx-spectrum', 'sinclair-zx-81'],
        args: ['-L', '{emulatorDir}\\cores\\{core}.dll', '{extraArgs}', '{rom}'],
        core: 'fuse_libretro',
        archives: 'pass',
        env: {},
        presetProfileId: 'retroarch:fuse_libretro',
      },
      {
        id: MAME_PROFILE,
        name: 'MAME – Acorn Atom',
        emulatorId: MAME,
        systems: ['acorn-atom'],
        args: ['atom', '-cass', '{rom}'],
        archives: 'pass',
        env: {},
      },
    ],
  });
}

const configs: SystemConfig[] = [
  {
    systemId: 'sinclair-zx-spectrum',
    name: 'Sinclair ZX Spectrum',
    path: 'E:\\RA\\config\\Sinclair ZX Spectrum.cfg',
  },
  { systemId: 'acorn-atom', name: 'Acorn Atom', path: 'E:\\RA\\config\\Acorn Atom.cfg' },
];

describe('addSystemConfigs (FR-IMP-2)', () => {
  it('gives a RetroArch system its own profile with -c <system>.cfg after the core', () => {
    const { next, items } = addSystemConfigs(settings(), configs, newId);
    const id = next.systems['sinclair-zx-spectrum']?.defaultProfileId;
    const copy = next.profiles.find((p) => p.id === id);
    expect(copy).toMatchObject({
      name: 'RetroArch – fuse · Sinclair ZX Spectrum',
      emulatorId: RA,
      systems: ['sinclair-zx-spectrum'],
      core: 'fuse_libretro',
      args: [
        '-L',
        '{emulatorDir}\\cores\\{core}.dll',
        '-c',
        'E:\\RA\\config\\Sinclair ZX Spectrum.cfg',
        '{extraArgs}',
        '{rom}',
      ],
    });
    // The shared profile is untouched and still covers its other systems.
    expect(next.profiles.find((p) => p.id === FUSE)?.args).not.toContain('-c');
    expect(items).toEqual([
      {
        area: 'system',
        key: 'Sinclair ZX Spectrum',
        reason: 'retroarchSystemConfig',
        detail: 'E:\\RA\\config\\Sinclair ZX Spectrum.cfg',
      },
    ]);
  });

  it('leaves systems that run another emulator alone', () => {
    const { next } = addSystemConfigs(settings(), configs, newId);
    expect(next.systems['acorn-atom']?.defaultProfileId).toBeUndefined();
    expect(next.profiles).toHaveLength(3);
  });

  it('changes nothing when imported again', () => {
    const once = addSystemConfigs(settings(), configs, newId).next;
    const twice = addSystemConfigs(once, configs, newId);
    expect(twice.next).toEqual(once);
    expect(twice.items).toEqual([]);
  });

  it('keeps braces in the path literal and the name within the limit', () => {
    const long = 'A'.repeat(70);
    const { next } = addSystemConfigs(
      settings(),
      [{ systemId: 'sinclair-zx-spectrum', name: long, path: 'E:\\RA\\config\\{x}.cfg' }],
      newId,
    );
    const copy = next.profiles.at(-1);
    expect(copy?.args).toContain('E:\\RA\\config\\{{x}}.cfg');
    expect(copy?.name.length).toBeLessThanOrEqual(80);
    expect(SettingsSchema.safeParse(next).success).toBe(true);
  });
});
