import { describe, expect, it } from 'vitest';
import { relocatePaths } from './relocate.ts';
import { defaultSettings, type Settings } from './schema.ts';

const UUID = '01a18273-adc6-74f5-84e4-af4637b87ce2';

function settingsWith(paths: {
  locations?: string[];
  assets?: string | null;
  themes?: string | null;
  media?: string;
  emulator?: string;
}): Settings {
  const base = defaultSettings();
  return {
    ...base,
    storage: {
      ...base.storage,
      locations: (paths.locations ?? []).map((path, index) => ({
        id: `01a18273-adc6-74f5-84e4-af4637b87c${String(index).padStart(2, '0')}`,
        name: `Drive ${String(index + 1)}`,
        path,
        priority: index + 1,
      })),
      assetsPath: paths.assets ?? null,
      themesPath: paths.themes ?? null,
      media: paths.media ? { mode: 'central', path: paths.media } : { mode: 'perRomFolder' },
    },
    emulators: paths.emulator ? [{ id: UUID, name: 'RetroArch', executable: paths.emulator }] : [],
  };
}

describe('relocatePaths (D50, Review Focus 5: a moved NextLevel folder)', () => {
  it('rewrites every settings path under the old root to the new root', () => {
    const { settings, changed } = relocatePaths(
      settingsWith({
        locations: ['E:\\NextLevel\\Catalog', 'D:\\roms'],
        assets: 'E:\\NextLevel\\assets',
        themes: 'E:\\NextLevel\\themes',
        media: 'E:\\NextLevel\\media',
        emulator: 'E:\\NextLevel\\emulators\\retroarch\\retroarch.exe',
      }),
      'E:\\NextLevel',
      'F:\\NextLevel',
    );
    expect(settings.storage.locations.map((l) => l.path)).toEqual([
      'F:\\NextLevel\\Catalog',
      'D:\\roms',
    ]);
    expect(settings.storage.assetsPath).toBe('F:\\NextLevel\\assets');
    expect(settings.storage.themesPath).toBe('F:\\NextLevel\\themes');
    expect(settings.storage.media).toEqual({ mode: 'central', path: 'F:\\NextLevel\\media' });
    expect(settings.emulators[0]?.executable).toBe(
      'F:\\NextLevel\\emulators\\retroarch\\retroarch.exe',
    );
    expect(changed).toBe(5);
  });

  it('a sibling folder that only shares the prefix is left alone', () => {
    const { settings, changed } = relocatePaths(
      settingsWith({ locations: ['E:\\NextLevel2\\x'] }),
      'E:\\NextLevel',
      'F:\\NextLevel',
    );
    expect(settings.storage.locations[0]?.path).toBe('E:\\NextLevel2\\x');
    expect(changed).toBe(0);
  });

  it('paths outside the folder are left as they are', () => {
    const { settings, changed } = relocatePaths(
      settingsWith({ locations: ['D:\\roms'], emulator: 'C:\\Emu\\pcsx2.exe' }),
      'E:\\NextLevel',
      'F:\\NextLevel',
    );
    expect(settings.storage.locations[0]?.path).toBe('D:\\roms');
    expect(settings.emulators[0]?.executable).toBe('C:\\Emu\\pcsx2.exe');
    expect(changed).toBe(0);
  });

  it('matches case-insensitively and with either slash; the root itself moves too', () => {
    const { settings, changed } = relocatePaths(
      settingsWith({ locations: ['e:\\nextlevel\\Catalog', 'E:/NextLevel'] }),
      'E:\\NextLevel\\',
      'F:\\Games\\NextLevel',
    );
    expect(settings.storage.locations.map((l) => l.path)).toEqual([
      'F:\\Games\\NextLevel\\Catalog',
      'F:\\Games\\NextLevel',
    ]);
    expect(changed).toBe(2);
  });
});
