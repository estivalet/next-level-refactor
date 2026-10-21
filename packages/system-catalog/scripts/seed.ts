// Regenerates data/systems.json. Dev-only; never runs in tests or CI.
//
//   npm run seed -w packages/system-catalog -- \
//     --launchers <NextLevelOS>/public/data/launchers.json \
//     --config <NextLevelOS>/public/data/config.json \
//     --screenscraper <NextLevelOS>/public/data/screenscraper.json \
//     --es-systems <download>/es_systems.xml \
//     --source "nextlevelos@<commit> + es-de v3.5.0"
//
// es_systems.xml: ES-DE's resources/systems/windows/es_systems.xml at the release named in
// --source (MIT, see NOTICE.md). The NextLevelOS files are only read.

import { SystemCatalogSchema } from '@nextlevel/shared';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCatalog, parseEsSystems, type SeedInput } from './mapping.ts';

/**
 * NextLevelOS names whose ES-DE fullname differs; value = ES-DE system `name`. Built from the
 * seed's "unmatched" report against es-de v3.5.0; only pairs that are clearly the same platform.
 * Variants share their base system's extensions (HBMAME → mame, SNES MSU-1 → snes, MSX2+ → msx2).
 */
const ES_ALIASES: Record<string, string> = {
  'Acorn BBC Micro': 'bbcmicro',
  'Adventure Game Studio': 'ags',
  Arduboy: 'arduboy',
  'Atari 7800': 'atari7800',
  'Atari XEGS': 'atarixe',
  ChaiLove: 'chailove',
  Daphne: 'daphne',
  'Dragon Data Dragon': 'dragon32',
  EasyRPG: 'easyrpg',
  'Flash Games': 'flash',
  Gamate: 'gamate',
  'Game & Watch': 'gameandwatch',
  HBMAME: 'mame',
  Laserdisc: 'laserdisc',
  'LCD Games': 'lcdgames',
  'LowRes NX': 'lowresnx',
  Lutro: 'lutro',
  MAME: 'mame',
  'Mattel Intellivision': 'intellivision',
  'Microsoft MSX': 'msx',
  'Microsoft MSX2': 'msx2',
  'Microsoft MSX2+': 'msx2',
  'Microsoft MSX Turbo R': 'msxturbor',
  MUGEN: 'mugen',
  'NEC PC-8801': 'pc88',
  'NEC PC-9801': 'pc98',
  'Nintendo Famicom': 'famicom',
  'Nintendo NES': 'nes',
  'Nintendo Satellaview BSX': 'satellaview',
  'Nintendo SNES': 'snes',
  'Nintendo SNES MSU-1': 'snes',
  'Nintendo Super Famicom': 'sfc',
  OpenBOR: 'openbor',
  'Panasonic 3DO': '3do',
  'Philips Videopac Plus G7400': 'videopac',
  'Sammy Atomiswave': 'atomiswave',
  ScummVM: 'scummvm',
  'Sega 32X': 'sega32x',
  'Sega ST-V': 'stv',
  'Sega Triforce': 'triforce',
  'Solarus RPG Game Engine': 'solarus',
  'Sony PS Vita': 'psvita',
  'Sony PSP': 'psp',
  'Tandy TRS-80 Color Computer': 'coco',
  'Tangerine Oric': 'oric',
  'Tangerine Oric Atmos': 'oric',
  'TIC-80 Tiny Computer': 'tic80',
  'Tiger Game.com': 'gamecom',
  Uzebox: 'uzebox',
  Vircon32: 'vircon32',
  'WASM-4': 'wasm4',
};

const { values } = parseArgs({
  options: {
    launchers: { type: 'string' },
    config: { type: 'string' },
    screenscraper: { type: 'string' },
    'es-systems': { type: 'string' },
    source: { type: 'string' },
    out: { type: 'string', default: join(import.meta.dirname, '..', 'data', 'systems.json') },
  },
});

function required(name: keyof typeof values): string {
  const value = values[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const { catalog, report } = buildCatalog({
  launchers: readJson(required('launchers')) as SeedInput['launchers'],
  globalExtensions: (readJson(required('config')) as { scanExtensions: string[] }).scanExtensions,
  screenscraper: readJson(required('screenscraper')) as Record<string, number>,
  esSystems: parseEsSystems(readFileSync(required('es-systems'), 'utf8')),
  aliases: ES_ALIASES,
  source: required('source'),
});

SystemCatalogSchema.parse(catalog);
writeFileSync(required('out'), `${JSON.stringify(catalog, null, 2)}\n`);

const matched = catalog.systems.length - report.unmatchedEs.length;
console.log(`systems: ${String(catalog.systems.length)}`);
console.log(`ES-DE matches: ${String(matched)}`);
console.log(`global-extension fallbacks: ${String(report.fallbackExtensions.length)}`);
console.log(`unmatched in ES-DE:\n  ${report.unmatchedEs.join('\n  ')}`);
