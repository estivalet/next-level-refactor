import { describe, expect, it } from 'vitest';
import releasedIds from '../data/released-ids.json' with { type: 'json' };
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

describe('id permanence (ADR-011)', () => {
  it('every released system id is still in the catalog', () => {
    const ids = new Set(systemCatalog().map((s) => s.id));
    const missing = releasedIds.filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('the released id list covers the whole catalog', () => {
    expect(releasedIds).toHaveLength(NEXTLEVELOS_SYSTEM_COUNT);
  });
});

describe('variant systems share their base system formats', () => {
  it.each([
    ['texas-instruments-ti-99-4a', 'rpk'],
    ['thomson-mo5', 'k7'],
    ['snk-neo-geo-aes', 'neo'],
    ['sega-sg-1000-ii', 'sg'],
  ])('FR-LIB-2: %s accepts .%s', (id, extension) => {
    expect(getSystem(id)?.extensions).toContain(extension);
  });

  it.each([
    ['nintendo-nes-msu-1', 'nintendo-nes'],
    ['nintendo-nes-hd', 'nintendo-nes'],
    ['nintendo-game-boy-advance-2-players', 'nintendo-game-boy-advance'],
    ['nintendo-game-boy-2-players', 'nintendo-game-boy'],
    ['sega-mega-drive-msu-1', 'sega-mega-drive'],
    ['thomson-to8', 'thomson-mo5'],
    ['fujitsu-fm-towns-marty', 'fujitsu-fm-towns'],
    ['snk-neo-geo-mvs', 'snk-neo-geo-aes'],
  ])('FR-LIB-2: %s has the same formats as %s', (variant, base) => {
    const baseExtensions = getSystem(base)?.extensions;
    expect(baseExtensions).not.toEqual(systemCatalog().find((s) => s.id === 'aae')?.extensions);
    expect(getSystem(variant)?.extensions).toEqual(baseExtensions);
  });
});
