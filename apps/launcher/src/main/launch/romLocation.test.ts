import { AppErrorException, defaultSettings, type Settings } from '@nextlevel/shared';
import { getSystem } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { locateRom, sampleRom } from './romLocation.ts';

const settings: Settings = {
  ...defaultSettings(),
  storage: {
    locations: [
      { id: 'a', name: 'A', path: 'E:\\roms', priority: 1 },
      { id: 'b', name: 'B', path: 'F:\\more', priority: 2 },
    ],
  },
};
const n64 = getSystem('nintendo-64');
const game = { systemId: 'nintendo-64', relPath: 'USA/Racer (USA).z64', locationId: 'b' };

describe('locateRom (data model §2.4)', () => {
  it('US-C2: the game’s own location is checked first', () => {
    const exists = (path: string) => path.startsWith('F:') || path.startsWith('E:');
    expect(locateRom({ settings, system: n64, ...game }, exists)).toEqual({
      path: 'F:\\more\\Nintendo 64\\USA\\Racer (USA).z64',
      systemDir: 'F:\\more\\Nintendo 64',
    });
  });

  it('US-C2: then the other locations by priority', () => {
    const exists = (path: string) => path.startsWith('E:');
    expect(locateRom({ settings, system: n64, ...game }, exists).path).toBe(
      'E:\\roms\\Nintendo 64\\USA\\Racer (USA).z64',
    );
  });

  it('FR-LIB-2: the user’s folder name override applies', () => {
    const custom = {
      ...settings,
      systems: { 'nintendo-64': { enabled: true, folderName: 'n64' } },
    };
    expect(locateRom({ settings: custom, system: n64, ...game }, () => true).systemDir).toBe(
      'F:\\more\\n64',
    );
  });

  it('US-C2: no file anywhere → ROM_MISSING with the expected path', () => {
    try {
      locateRom({ settings, system: n64, ...game }, () => false);
      expect.fail('should throw');
    } catch (error) {
      expect((error as AppErrorException).error).toMatchObject({
        code: 'ROM_MISSING',
        details: { path: 'F:\\more\\Nintendo 64\\USA\\Racer (USA).z64' },
      });
    }
  });
});

describe('sampleRom', () => {
  it('FR-EMU-5: previews without a game use an example file on the first location', () => {
    expect(sampleRom(settings, n64, 'nintendo-64')).toEqual({
      path: `E:\\roms\\Nintendo 64\\Example Game (USA).${n64?.extensions[0] ?? ''}`,
      systemDir: 'E:\\roms\\Nintendo 64',
    });
    expect(sampleRom(defaultSettings(), undefined, 'x').path).toBe(
      'C:\\Games\\x\\Example Game (USA).zip',
    );
  });
});
