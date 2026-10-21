import type { SystemCatalog, SystemDefinition } from '@nextlevel/shared';
import { XMLParser } from 'fast-xml-parser';

// Builds the system catalog from NextLevelOS data plus ES-DE's es_systems.xml (MIT). Pure, so the
// seed's decisions are tested on fixtures; seed.ts only reads files and writes the result.

export interface EsSystem {
  name: string;
  fullname: string;
  extensions: string[];
}

export interface SeedInput {
  launchers: Record<string, { romext?: string[] }>;
  globalExtensions: string[];
  screenscraper: Record<string, number>;
  esSystems: EsSystem[];
  /** NextLevelOS name → ES-DE system `name`, for systems whose names differ. */
  aliases: Record<string, string>;
  source: string;
}

export interface SeedReport {
  /** NextLevelOS systems with no ES-DE match (extensions from romext or the global list). */
  unmatchedEs: string[];
  /** Systems that got the global scanExtensions list. */
  fallbackExtensions: string[];
}

/** Name prefixes that identify a manufacturer reliably. Longest first so "Sega" ≠ "Sega Toys". */
const KNOWN_MANUFACTURERS = [
  'Texas Instruments',
  'Data East',
  'Nintendo',
  'Sega',
  'Sony',
  'Atari',
  'NEC',
  'SNK',
  'Commodore',
  'Amstrad',
  'Acorn',
  'Apple',
  'Bandai',
  'Microsoft',
  'Philips',
  'Mattel',
  'Coleco',
  'Magnavox',
  'Fujitsu',
  'Sharp',
  'Panasonic',
  'Tiger',
  'Casio',
  'Epoch',
  'Emerson',
  'Fairchild',
  'Entex',
  'Watara',
  'VTech',
  'Tandy',
  'Sinclair',
  'Thomson',
  'Dragon',
  'Oric',
  'Enterprise',
  'Exidy',
  'Hartung',
  'Funtech',
  'GCE',
  'Interton',
  'RCA',
  'Bally',
  'Benesse',
  'Konami',
  'Capcom',
  'Namco',
  'Taito',
  'Irem',
  'Midway',
  'Williams',
  'Gottlieb',
  'Stern',
].sort((a, b) => b.length - a.length);

const ARCADE = /arcade|mame|naomi|atomiswave|model [23]|\bcps\b|neo ?geo mvs/i;
const PINBALL = /pinball/i;

function ascii(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Permanent system id from a display name: lowercase ascii, runs of other characters → '-'. */
export function slugify(name: string): string {
  return (
    ascii(name)
      .toLowerCase()
      // "MSX2" and "MSX2+" are different systems.
      .replace(/\+/g, ' plus ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function matchKey(name: string): string {
  return ascii(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * ES-DE also launches Windows shortcuts and scripts. A scan would then list stray shortcuts as
 * games, so they are kept only for systems that have nothing else (PC game engines).
 */
const LAUNCHER_FILES = new Set(['lnk', 'url', 'bat']);

function withoutLauncherFiles(extensions: string[]): string[] {
  const roms = extensions.filter((e) => !LAUNCHER_FILES.has(e));
  return roms.length > 0 ? roms : extensions;
}

function normalizeExtensions(extensions: readonly string[]): string[] {
  const clean = extensions.map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
  return [...new Set(clean)];
}

export function parseEsSystems(xml: string): EsSystem[] {
  // parseTagValue: false keeps every value as text (a system named "3do" stays a string).
  const parser = new XMLParser({ isArray: (name) => name === 'system', parseTagValue: false });
  const parsed = parser.parse(xml) as {
    systemList?: { system?: { name: string; fullname: string; extension?: string }[] };
  };
  return (parsed.systemList?.system ?? []).map((system) => ({
    name: system.name,
    fullname: system.fullname,
    extensions: normalizeExtensions((system.extension ?? '').split(/\s+/)),
  }));
}

function manufacturerOf(name: string): string | undefined {
  return KNOWN_MANUFACTURERS.find((m) => name === m || name.startsWith(`${m} `));
}

function kindOf(name: string): SystemDefinition['kind'] {
  if (PINBALL.test(name)) return 'pinball';
  if (ARCADE.test(name)) return 'arcade';
  return 'other';
}

export function buildCatalog(input: SeedInput): { catalog: SystemCatalog; report: SeedReport } {
  const byEsName = new Map(input.esSystems.map((s) => [s.name, s]));
  const byFullname = new Map(input.esSystems.map((s) => [matchKey(s.fullname), s]));
  const report: SeedReport = { unmatchedEs: [], fallbackExtensions: [] };
  const ids = new Set<string>();

  const names = Object.keys(input.launchers).sort((a, b) => a.localeCompare(b, 'en'));
  const systems = names.map((name): SystemDefinition => {
    const id = slugify(name);
    if (ids.has(id)) throw new Error(`duplicate system id ${id} (from "${name}")`);
    ids.add(id);

    const aliasTarget = input.aliases[name];
    const es =
      (aliasTarget ? byEsName.get(aliasTarget) : undefined) ?? byFullname.get(matchKey(name));
    if (!es) report.unmatchedEs.push(name);
    const romext = normalizeExtensions(input.launchers[name]?.romext ?? []);
    let extensions = es ? withoutLauncherFiles(es.extensions) : romext;
    if (extensions.length === 0) {
      extensions = normalizeExtensions(input.globalExtensions);
      report.fallbackExtensions.push(name);
    }

    const manufacturer = manufacturerOf(name);
    const screenscraperId = input.screenscraper[name];
    return {
      id,
      name,
      ...(manufacturer ? { manufacturer } : {}),
      kind: kindOf(name),
      extensions,
      defaultFolderName: name,
      scraper: screenscraperId ? { screenscraperId } : {},
      presetProfiles: [],
      aliases: [name],
    };
  });

  return { catalog: { source: input.source, systems }, report };
}
