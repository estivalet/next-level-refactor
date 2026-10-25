import { defaultSettings, SystemSettingsSchema, type Settings } from '@nextlevel/shared';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mediaDir, romStem } from './mediaTarget.ts';

function settings(patch: (s: Settings) => void = () => undefined): Settings {
  const s = defaultSettings();
  s.storage.locations = [
    { id: 'loc-1', name: 'A', path: join('E:', 'roms'), priority: 1 },
    { id: 'loc-2', name: 'B', path: join('F:', 'more'), priority: 2 },
  ];
  patch(s);
  return s;
}

const system = { defaultFolderName: 'Super Nintendo' };

describe('romStem (FR-SCR-4)', () => {
  it('is the file name without its last extension, verbatim', () => {
    expect(romStem('Foo (USA) [!].zip')).toBe('Foo (USA) [!]');
    expect(romStem("Bär & Co.'s.sfc")).toBe("Bär & Co.'s");
    expect(romStem('trailing..zip')).toBe('trailing.');
    expect(romStem('!hacks/x.sfc')).toBe('x');
    expect(romStem('noext')).toBe('noext');
  });
});

describe('mediaDir (FR-SCR-4)', () => {
  it("per-ROM folder: the game's location, system folder, media", () => {
    const game = { systemId: 'snes', locationId: 'loc-2', relPath: '!hacks/x.sfc' };
    expect(mediaDir(game, settings(), system)).toBe(join('F:', 'more', 'Super Nintendo', 'media'));
  });

  it('per-ROM folder follows the folder name override', () => {
    const game = { systemId: 'snes', locationId: 'loc-1', relPath: 'x.sfc' };
    const s = settings((v) => {
      v.systems.snes = SystemSettingsSchema.parse({ enabled: true, folderName: 'SNES' });
    });
    expect(mediaDir(game, s, system)).toBe(join('E:', 'roms', 'SNES', 'media'));
  });

  it('central mode: <central>/<systemId>', () => {
    const game = { systemId: 'snes', locationId: 'loc-1', relPath: 'x.sfc' };
    const s = settings((v) => {
      v.storage.media = { mode: 'central', path: join('G:', 'art') };
    });
    expect(mediaDir(game, s, system)).toBe(join('G:', 'art', 'snes'));
  });

  it('no storage location: null', () => {
    const game = { systemId: 'snes', locationId: null, relPath: 'x.sfc' };
    const s = settings((v) => {
      v.storage.locations = [];
    });
    expect(mediaDir(game, s, system)).toBeNull();
  });
});
