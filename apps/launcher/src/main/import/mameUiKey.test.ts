import { SettingsSchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { addMameUiKey } from './mameUiKey.ts';

const MAME = '01900000-0000-7000-8000-0000000000e1';
const RA = '01900000-0000-7000-8000-0000000000e2';
const ATOM = '01900000-0000-7000-8000-0000000000f1';
const ARCADE = '01900000-0000-7000-8000-0000000000f2';
const FUSE = '01900000-0000-7000-8000-0000000000f3';

function settings() {
  return SettingsSchema.parse({
    schemaVersion: 2,
    systems: {
      'acorn-atom': { enabled: true, defaultProfileId: ATOM },
      arcade: { enabled: true, defaultProfileId: ARCADE },
      'sinclair-zx-spectrum': { enabled: true, defaultProfileId: FUSE },
    },
    emulators: [
      { id: MAME, name: 'MAME', presetId: 'mame', executable: 'E:\\MAME\\mame.exe' },
      { id: RA, name: 'RetroArch', presetId: 'retroarch', executable: 'E:\\RA\\retroarch.exe' },
    ],
    profiles: [
      {
        id: ATOM,
        name: 'MAME – Acorn Atom',
        emulatorId: MAME,
        systems: ['acorn-atom'],
        args: [
          'atom',
          '-cass',
          '{rom}',
          '-rompath',
          '{systemDir}',
          '-skip_gameinfo',
          '{extraArgs}',
        ],
        archives: 'pass',
        env: {},
      },
      {
        id: ARCADE,
        name: 'MAME – Arcade',
        emulatorId: MAME,
        systems: ['arcade'],
        args: ['{romName}', '-uimodekey', 'TAB', '{extraArgs}'],
        archives: 'pass',
        env: {},
      },
      {
        id: FUSE,
        name: 'RetroArch – fuse',
        emulatorId: RA,
        systems: ['sinclair-zx-spectrum'],
        args: ['-L', '{emulatorDir}\\cores\\{core}.dll', '{extraArgs}', '{rom}'],
        archives: 'pass',
        env: {},
      },
    ],
  });
}

const ids = ['acorn-atom', 'arcade', 'sinclair-zx-spectrum'];

describe('addMameUiKey (FR-IMP-2)', () => {
  it('gives MAME profiles -uimodekey DEL before -skip_gameinfo, as NextLevelOS ran them', () => {
    const { next, items } = addMameUiKey(settings(), ids);
    expect(next.profiles.find((p) => p.id === ATOM)?.args).toEqual([
      'atom',
      '-cass',
      '{rom}',
      '-rompath',
      '{systemDir}',
      '-uimodekey',
      'DEL',
      '-skip_gameinfo',
      '{extraArgs}',
    ]);
    expect(items).toEqual([
      {
        area: 'emulator',
        key: 'MAME',
        reason: 'mameUiModeKey',
        detail: '-uimodekey DEL',
        count: 1,
      },
    ]);
  });

  it('keeps a UI key the profile already chose, and leaves other emulators alone', () => {
    const { next } = addMameUiKey(settings(), ids);
    expect(next.profiles.find((p) => p.id === ARCADE)?.args).toContain('TAB');
    expect(next.profiles.find((p) => p.id === FUSE)?.args).not.toContain('-uimodekey');
  });

  it('only touches the imported systems and changes nothing the second time', () => {
    expect(addMameUiKey(settings(), ['sinclair-zx-spectrum']).items).toEqual([]);
    const once = addMameUiKey(settings(), ids).next;
    const twice = addMameUiKey(once, ids);
    expect(twice.next).toEqual(once);
    expect(twice.items).toEqual([]);
  });
});
