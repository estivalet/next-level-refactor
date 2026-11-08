import { describe, expect, it } from 'vitest';
import { byName, matchesSearch, needsAttention, profileLabel } from './emulatorSearch.ts';

describe('emulatorSearch (FR-EMU-2)', () => {
  it('FR-EMU-2: byName sorts A–Z ignoring case and accents, numbers in order', () => {
    const names = ['scummvm', 'MAME', 'Dolphin', 'émulateur', 'RetroArch 10', 'RetroArch 9'];
    expect(
      [...names]
        .map((name) => ({ name }))
        .sort(byName)
        .map((e) => e.name),
    ).toEqual(['Dolphin', 'émulateur', 'MAME', 'RetroArch 9', 'RetroArch 10', 'scummvm']);
  });

  it('FR-EMU-2: matchesSearch ignores case, accents and extra spaces; empty matches all', () => {
    expect(matchesSearch('MAME – Jupiter Ace', '  jupiter ')).toBe(true);
    expect(matchesSearch('Émulateur', 'emul')).toBe(true);
    expect(matchesSearch('Dolphin', 'mame')).toBe(false);
    expect(matchesSearch('Dolphin', '')).toBe(true);
  });

  it('FR-EMU-2: profileLabel drops the emulator name prefix, keeps other names', () => {
    expect(profileLabel('MAME – Jupiter Ace', 'MAME')).toBe('Jupiter Ace');
    expect(profileLabel('RetroArch - nestopia', 'RetroArch')).toBe('nestopia');
    expect(profileLabel('RetroArch: genesis', 'retroarch')).toBe('genesis');
    expect(profileLabel('ScummVM', 'ScummVM')).toBe('ScummVM');
    expect(profileLabel('MAMEish thing', 'MAME')).toBe('MAMEish thing');
    expect(profileLabel('Dolphin GC', 'Dolphin')).toBe('Dolphin GC');
  });

  it('FR-EMU-2: needsAttention flags an emulator whose fields or profiles have errors', () => {
    const errors = { 'emulators.1.executable': 'x', 'profiles.3.args.0': 'y' };
    expect(needsAttention(errors, 1, [])).toBe(true);
    expect(needsAttention(errors, 0, [3])).toBe(true);
    expect(needsAttention(errors, 0, [2, 13])).toBe(false);
  });
});
