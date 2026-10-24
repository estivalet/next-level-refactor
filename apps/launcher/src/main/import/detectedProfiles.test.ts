import { SettingsSchema, type DetectedEmulator } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { addDetectedProfiles } from './detectedProfiles.ts';

let n = 0;
const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
const EMU = '01900000-0000-7000-8000-0000000000e1';
const PROFILE = '01900000-0000-7000-8000-0000000000f1';

const detected: DetectedEmulator[] = [
  { presetId: 'duckstation', executable: 'E:\\emulators\\duckstation\\duckstation-qt.exe' },
  { presetId: 'retroarch', executable: 'E:\\emulators\\RetroArch\\retroarch.exe' },
];

function settings() {
  return SettingsSchema.parse({
    schemaVersion: 1,
    systems: {
      'atari-2600': { enabled: true },
      'sony-playstation': { enabled: true, defaultProfileId: PROFILE },
      'nintendo-64': { enabled: false },
    },
    emulators: [{ id: EMU, name: 'Mine', executable: 'C:\\Mine\\mine.exe' }],
    profiles: [
      {
        id: PROFILE,
        name: 'Mine',
        emulatorId: EMU,
        systems: ['sony-playstation'],
        args: ['{rom}'],
        archives: 'pass',
        env: {},
      },
    ],
  });
}

const run = (current = settings(), found = detected) =>
  addDetectedProfiles(current, found, systemCatalog(), emulatorPresets(), newId);

describe('addDetectedProfiles (D14)', () => {
  it('FR-IMP-2: adds a preset profile and default only for enabled systems with none', () => {
    const { next, items } = run();
    const retroarch = next.emulators.find((e) => e.presetId === 'retroarch');
    expect(retroarch?.executable).toBe('E:\\emulators\\RetroArch\\retroarch.exe');
    const added = next.profiles.filter((p) => p.emulatorId === retroarch?.id);
    expect(added.map((p) => p.presetProfileId)).toEqual(['retroarch:stella_libretro']);
    expect(next.systems['atari-2600']?.defaultProfileId).toBe(added[0]?.id);
    expect(next.systems['sony-playstation']?.defaultProfileId).toBe(PROFILE);
    expect(next.emulators.some((e) => e.presetId === 'duckstation')).toBe(false);
    expect(items).toEqual([
      {
        area: 'emulator',
        key: 'RetroArch',
        reason: 'emulatorAdded',
        detail: 'E:\\emulators\\RetroArch\\retroarch.exe',
        count: 1,
      },
    ]);
    expect(SettingsSchema.safeParse(next).success).toBe(true);
  });

  it('FR-IMP-2: running it again adds nothing', () => {
    const once = run().next;
    const twice = run(once);
    expect(twice.next).toEqual(once);
    expect(twice.items).toEqual([]);
  });

  it('FR-IMP-2: nothing detected leaves settings as they were', () => {
    const current = settings();
    expect(run(current, []).next).toEqual(current);
  });
});
