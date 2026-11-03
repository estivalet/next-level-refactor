// Writes each system's LaunchBox platform name into data/systems.json (FR-SCR-6).
// Dev-only; never runs in tests or CI. Usage:
//   node packages/system-catalog/scripts/launchbox-map.ts --platforms <Platforms.xml>
// (Platforms.xml is inside https://gamesdb.launchbox-app.com/Metadata.zip; never commit it.)
import { SystemCatalogSchema } from '@nextlevel/shared';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { POPULAR_SYSTEM_IDS } from '../src/popular.ts';
import { matchPlatform, parsePlatforms } from './launchboxPlatforms.ts';

/** Systems whose names don't match a LaunchBox platform exactly. */
export const OVERRIDES: Readonly<Record<string, string>> = {
  'coleco-colecovision': 'ColecoVision',
  'sega-mega-cd': 'Sega CD',
  'sega-32x-cd': 'Sega CD 32X',
  'sega-mark-iii': 'Sega Master System',
  'sega-mega-drive-msu-1': 'Sega Genesis',
  'sega-naomi-gd-rom': 'Sega Naomi',
  'sega-naomi-2-gd-rom': 'Sega Naomi 2',
  'sega-sg-1000-ii': 'Sega SG-1000',
  'sega-vmu': 'Sega Dreamcast VMU',
  'sega-triforce-old': 'Sega Triforce',
  'nintendo-famicom': 'Nintendo Entertainment System',
  'nintendo-nes-hd': 'Nintendo Entertainment System',
  'nintendo-nes-3d': 'Nintendo Entertainment System',
  'nintendo-nes-msu-1': 'Nintendo Entertainment System',
  'nintendo-snes-msu-1': 'Super Nintendo Entertainment System',
  'nintendo-satellaview-bsx': 'Nintendo Satellaview',
  'nintendo-game-boy-2-players': 'Nintendo Game Boy',
  'nintendo-game-boy-color-2-players': 'Nintendo Game Boy Color',
  'nintendo-game-boy-advance-2-players': 'Nintendo Game Boy Advance',
  'microsoft-xbla': 'Microsoft Xbox 360',
  'microsoft-windows-3-x': 'Windows 3.X',
  'microsoft-msx-turbo-r': 'Microsoft MSX2+',
  'sony-ps-vita': 'Sony Playstation Vita',
  'apple-macintosh': 'Apple Mac OS',
  'philips-videopac-plus-g7400': 'Philips Videopac+',
  'tangerine-oric-atmos': 'Oric Atmos',
  'memotech-mtx': 'Memotech MTX512',
  'spectravideo-sv-318': 'Spectravideo',
  'taito-type-x2': 'Taito Type X',
  'taito-type-x3': 'Taito Type X',
  'taito-type-x4': 'Taito Type X',
  'taito-type-x-zero': 'Taito Type X',
  'final-burn-neo': 'Arcade',
  hbmame: 'Arcade',
  'pico-8-fantasy-console': 'PICO-8',
  'mattel-captain-power': 'WoW Action Max',
  'visual-pinball': 'Pinball',
  'future-pinball': 'Pinball',
};

const { values } = parseArgs({
  options: {
    platforms: { type: 'string' },
    out: { type: 'string', default: join(import.meta.dirname, '..', 'data', 'systems.json') },
  },
});
if (!values.platforms) throw new Error('--platforms is required');

const platforms = parsePlatforms(readFileSync(values.platforms, 'utf8'));
const known = new Set(platforms.map((platform) => platform.name));
const catalog = SystemCatalogSchema.parse(JSON.parse(readFileSync(values.out, 'utf8')));
const unmatched: string[] = [];
for (const system of catalog.systems) {
  const platform = OVERRIDES[system.id] ?? matchPlatform(system, platforms);
  if (platform && !known.has(platform)) throw new Error(`unknown platform ${platform}`);
  const { launchboxPlatform: _old, ...scraper } = system.scraper;
  system.scraper = platform ? { ...scraper, launchboxPlatform: platform } : scraper;
  if (!platform) unmatched.push(system.id);
}
writeFileSync(values.out, `${JSON.stringify(catalog, null, 2)}\n`);
const popular = unmatched.filter((id) => POPULAR_SYSTEM_IDS.includes(id));
console.log(
  `${String(catalog.systems.length - unmatched.length)} of ${String(catalog.systems.length)} systems matched.`,
);
console.log(`Unmatched popular systems: ${popular.join(', ') || 'none'}`);
console.log(`Unmatched: ${unmatched.join(', ')}`);
