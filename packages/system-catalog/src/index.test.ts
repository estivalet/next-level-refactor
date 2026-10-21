import { describe, expect, it } from 'vitest';
import { effectiveSystem, getSystem, NEXTLEVELOS_SYSTEM_COUNT, systemCatalog } from './index.ts';

describe('system catalog', () => {
  it('FR-EMU-1: the shipped catalog is valid and has unique ids', () => {
    const ids = systemCatalog().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('FR-EMU-1: it covers every NextLevelOS system', () => {
    expect(systemCatalog()).toHaveLength(NEXTLEVELOS_SYSTEM_COUNT);
  });

  it('FR-EMU-1: nintendo-64 has its ES-DE extensions and ScreenScraper id', () => {
    const n64 = getSystem('nintendo-64');
    expect(n64?.extensions).toContain('z64');
    expect(n64?.scraper.screenscraperId).toBe(14);
  });

  it('getSystem returns undefined for unknown ids', () => {
    expect(getSystem('nope')).toBeUndefined();
  });
});

describe('effectiveSystem', () => {
  const def = {
    id: 'nintendo-64',
    name: 'Nintendo 64',
    kind: 'other' as const,
    extensions: ['z64', 'n64'],
    defaultFolderName: 'Nintendo 64',
    scraper: {},
    presetProfiles: [],
    aliases: [],
  };

  it('FR-LIB-2: uses catalog defaults when there are no overrides', () => {
    expect(effectiveSystem(def)).toEqual({
      folderName: 'Nintendo 64',
      extensions: ['z64', 'n64'],
      enabled: false,
    });
  });

  it('FR-LIB-2: uses the folder name and extensions overrides', () => {
    expect(effectiveSystem(def, { enabled: true, folderName: 'N64', extensions: ['z64'] })).toEqual(
      { folderName: 'N64', extensions: ['z64'], enabled: true },
    );
  });
});
