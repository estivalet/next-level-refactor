import { defaultSettings, type Settings } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import {
  folderNameFrom,
  withCustomSystemPatch,
  withNewCustomSystem,
  withoutCustomSystem,
} from './customSystemsDraft.ts';

const PROFILE: Settings['profiles'][number] = {
  id: '018f2c1e-0000-7000-8000-000000000001',
  emulatorId: '018f2c1e-0000-7000-8000-000000000002',
  name: 'Two systems',
  args: ['{rom}'],
  systems: ['nintendo-switch', 'custom-nintendo-switch-2'],
  archives: 'pass',
  squashfs: 'pass',
  entries: [],
  pointerExtensions: [],
  env: {},
};

function withSwitch2(): Settings {
  return withNewCustomSystem(
    defaultSettings(),
    { name: 'Nintendo Switch 2', extensions: ['xci', 'nsp'] },
    ['nintendo-switch'],
  ).settings;
}

describe('custom system drafts (FR-EMU-11)', () => {
  it('FR-EMU-11: adding creates an enabled system named after its folder', () => {
    const { settings, id } = withNewCustomSystem(
      defaultSettings(),
      { name: ' Nintendo Switch 2 ', extensions: ['xci'] },
      [],
    );
    expect(id).toBe('custom-nintendo-switch-2');
    expect(settings.customSystems).toEqual([
      {
        id,
        name: 'Nintendo Switch 2',
        kind: 'console',
        folderName: 'Nintendo Switch 2',
        extensions: ['xci'],
      },
    ]);
    expect(settings.systems[id]).toEqual({ enabled: true });
  });

  it('FR-EMU-11: the id avoids ids already in use', () => {
    const first = withSwitch2();
    const { id } = withNewCustomSystem(first, { name: 'Nintendo Switch 2', extensions: ['xci'] }, [
      'custom-nintendo-switch-2',
    ]);
    expect(id).toBe('custom-nintendo-switch-2-2');
  });

  it('FR-EMU-11: folder names drop characters Windows does not allow', () => {
    expect(folderNameFrom('Sega: Saturn / ST-V?')).toBe('Sega Saturn ST-V');
    expect(folderNameFrom('???')).toBe('System');
  });

  it('FR-EMU-11: a patch changes fields; undefined removes an optional one', () => {
    let settings = withSwitch2();
    settings = withCustomSystemPatch(settings, 'custom-nintendo-switch-2', {
      shortName: 'Switch 2',
      releaseYear: 2025,
    });
    settings = withCustomSystemPatch(settings, 'custom-nintendo-switch-2', {
      releaseYear: undefined,
    });
    expect(settings.customSystems[0]).toMatchObject({ shortName: 'Switch 2' });
    expect(settings.customSystems[0]).not.toHaveProperty('releaseYear');
  });

  it('FR-EMU-11: removing drops the system, its settings and its id from profiles', () => {
    const settings = {
      ...withSwitch2(),
      profiles: [PROFILE, { ...PROFILE, id: 'only', systems: ['custom-nintendo-switch-2'] }],
    };
    const next = withoutCustomSystem(settings, 'custom-nintendo-switch-2');
    expect(next.customSystems).toEqual([]);
    expect(next.systems).not.toHaveProperty('custom-nintendo-switch-2');
    expect(next.profiles[0]?.systems).toEqual(['nintendo-switch']);
    // A profile can't have no systems: it keeps the id and shows in Emulators for a fix.
    expect(next.profiles[1]?.systems).toEqual(['custom-nintendo-switch-2']);
  });
});
