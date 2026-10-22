import { defaultSettings, type Settings } from '@nextlevel/shared';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { system } from '../scan/testing.ts';
import { expectedGamePath } from './expectedPath.ts';

const A = '0192b2a0-0000-7000-8000-00000000000a';
const B = '0192b2a0-0000-7000-8000-00000000000b';
const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...defaultSettings(),
  storage: {
    ...defaultSettings().storage,
    locations: [
      { id: A, name: 'A', path: 'E:\\roms', priority: 1 },
      { id: B, name: 'B', path: 'F:\\more', priority: 2 },
    ],
  },
  ...overrides,
});
const n64 = system('nintendo-64', { defaultFolderName: 'Nintendo 64' });

describe('expectedGamePath', () => {
  it("FR-LIB-4: a missing game's path uses its own location and the system folder", () => {
    expect(
      expectedGamePath({
        settings: settings(),
        system: n64,
        systemId: 'nintendo-64',
        locationId: B,
        relPath: 'USA/Game.z64',
      }),
    ).toBe(join('F:\\more', 'Nintendo 64', 'USA', 'Game.z64'));
  });

  it('FR-LIB-4: a removed location falls back to the first one; folder overrides apply', () => {
    expect(
      expectedGamePath({
        settings: settings({ systems: { 'nintendo-64': { enabled: true, folderName: 'n64' } } }),
        system: n64,
        systemId: 'nintendo-64',
        locationId: 'gone',
        relPath: 'Game.z64',
      }),
    ).toBe(join('E:\\roms', 'n64', 'Game.z64'));
  });

  it('FR-LIB-4: without locations the path is the rel_path', () => {
    expect(
      expectedGamePath({
        settings: defaultSettings(),
        system: undefined,
        systemId: 'gone-system',
        locationId: null,
        relPath: 'USA/Game.z64',
      }),
    ).toBe('USA/Game.z64');
  });
});
