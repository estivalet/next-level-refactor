import { systemCatalog } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { perfBudget } from '../library/testing.ts';
import { mapCollections } from './mapCollections.ts';
import { mapGames } from './mapGames.ts';
import { createSystemMatcher } from './matchSystem.ts';
import type { LegacyFiles } from './readLegacy.ts';

/** 100k entries over 50 systems plus 600 collections of 150 entries (90k), all invented. */
function syntheticFiles(): LegacyFiles {
  const systems = systemCatalog().slice(0, 50);
  const launchers: LegacyFiles['launchers'] = {};
  const gamelists: LegacyFiles['gamelists'] = [];
  for (const system of systems) {
    launchers[system.name] = { command: '%NEXTLEVEL_RUNNER%', rompath: [] };
    gamelists.push({
      name: system.name,
      games: Array.from({ length: 2000 }, (_, i) => ({
        filename: `./Game ${String(Math.floor(i / 2))} (Disc ${String((i % 2) + 1)}).zip`,
        title: `Game ${String(i)}`,
        year: '1990',
        played: String(i % 7),
        lastPlayedOn: '7/21/2026, 7:49:00 PM',
        filter: ['official', 'favorite', 'msxdev_2003'],
        core: 'some_libretro',
        config: 'cfg',
      })),
    });
  }
  for (let c = 0; c < 600; c++) {
    gamelists.push({
      name: `Collection ${String(c)}`,
      games: Array.from({ length: 150 }, (_, i) => ({
        filename: `./Game ${String(i)}.zip`,
        system: systems[i % systems.length]?.name,
      })),
    });
  }
  return {
    config: null,
    launchers,
    menus: [],
    gamelists,
    themes: null,
    screenscraper: {},
  };
}

describe('import mapping performance', () => {
  it('NFR-PERF: 100k gamelist entries and 90k collection entries map within budget', () => {
    const files = syntheticFiles();
    const match = createSystemMatcher(systemCatalog());
    const started = performance.now();
    const games = mapGames(files, match, { retroarchDir: 'E:\\RA' });
    const collections = mapCollections(files, match);
    const elapsed = performance.now() - started;
    expect(games.entries).toHaveLength(50000);
    expect(collections.collections).toHaveLength(600);
    expect(elapsed).toBeLessThan(perfBudget(5000));
  });
});
