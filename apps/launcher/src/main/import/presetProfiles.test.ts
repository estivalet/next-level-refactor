import { SettingsSchema } from '@nextlevel/shared';
import { emulatorPresets } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { addPresetProfiles, profileIdFor } from './presetProfiles.ts';

let n = 0;
const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
const MAME = '01900000-0000-7000-8000-0000000000e1';

function settings() {
  return SettingsSchema.parse({
    schemaVersion: 2,
    systems: { 'amstrad-gx4000': { enabled: true }, 'acorn-atom': { enabled: true } },
    emulators: [{ id: MAME, name: 'MAME', presetId: 'mame', executable: 'E:\\MAME\\mame.exe' }],
  });
}

const wanted = [
  { systemId: 'amstrad-gx4000', presetProfileId: 'mame:amstrad-gx4000' },
  { systemId: 'acorn-atom', presetProfileId: 'mame:acorn-atom:flop1' },
  { systemId: 'coleco-colecovision', presetProfileId: 'colem:default' },
];

describe('addPresetProfiles (FR-EMU-4)', () => {
  it('copies the preset profiles imported games run with, for the systems that want them', () => {
    const { next } = addPresetProfiles(settings(), wanted, emulatorPresets(), newId);
    const flop = next.profiles.find((p) => p.presetProfileId === 'mame:acorn-atom:flop1');
    expect(flop).toMatchObject({ emulatorId: MAME, systems: ['acorn-atom'] });
    expect(flop?.args.slice(0, 3)).toEqual(['atom', '-flop1', '{rom}']);
    expect(profileIdFor(next, 'acorn-atom', 'mame:acorn-atom:flop1')).toBe(flop?.id);
    // Defaults are untouched: the copies are options for the games that name them.
    expect(next.systems['acorn-atom']?.defaultProfileId).toBeUndefined();
  });

  it('reports a wanted emulator that is not set up, once per emulator', () => {
    const { next, items } = addPresetProfiles(settings(), wanted, emulatorPresets(), newId);
    expect(profileIdFor(next, 'coleco-colecovision', 'colem:default')).toBeNull();
    expect(items).toEqual([
      { area: 'emulator', key: 'ColEm', reason: 'presetEmulatorMissing', count: 1 },
    ]);
  });

  it('adds missing systems to an existing copy and changes nothing the second time', () => {
    const once = addPresetProfiles(settings(), wanted.slice(0, 1), emulatorPresets(), newId).next;
    const more = [
      ...wanted.slice(0, 1),
      { systemId: 'arcade', presetProfileId: 'mame:amstrad-gx4000' },
    ];
    const grown = addPresetProfiles(once, more, emulatorPresets(), newId).next;
    expect(grown.profiles).toHaveLength(1);
    expect(grown.profiles[0]?.systems).toEqual(['amstrad-gx4000', 'arcade']);
    expect(addPresetProfiles(grown, more, emulatorPresets(), newId).next).toEqual(grown);
  });
});
