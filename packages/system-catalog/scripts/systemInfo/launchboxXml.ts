import { SYSTEM_INFO_TEXT_LIMITS as LIMITS, type SystemInfoSource } from '@nextlevel/shared';
import { XMLParser } from 'fast-xml-parser';
import { cleanText, cleanYear, type SystemInfoEntry } from './normalize.ts';

// LaunchBox Games Database `Platforms.xml` → museum fields (FR-MUS-1, FR-MUS-5). Fills gaps only.

export interface LaunchBoxPlatformInfo {
  name: string;
  alternateNames: string[];
  releaseYear?: number;
  manufacturer?: string;
  cpu?: string;
  ram?: string;
  graphics?: string;
  sound?: string;
  display?: string;
  media?: string;
  notes?: string;
}

type XmlRow = Record<string, unknown>;
interface LaunchBoxFile {
  LaunchBox?: { Platform?: XmlRow[]; PlatformAlternateName?: XmlRow[] };
}

const LAUNCHBOX_SOURCE: SystemInfoSource = {
  name: 'LaunchBox Games Database',
  url: 'https://gamesdb.launchbox-app.com/',
};

export function parseLaunchBoxPlatforms(xml: string): LaunchBoxPlatformInfo[] {
  // parseTagValue: false keeps every value as text.
  const parser = new XMLParser({
    isArray: (name) => name === 'Platform' || name === 'PlatformAlternateName',
    parseTagValue: false,
  });
  const root = (parser.parse(xml) as LaunchBoxFile).LaunchBox;
  const alternates = new Map<string, string[]>();
  for (const row of root?.PlatformAlternateName ?? []) {
    const name = cleanText(row.Name, 200);
    const alternate = cleanText(row.Alternate, 200);
    if (name && alternate) alternates.set(name, [...(alternates.get(name) ?? []), alternate]);
  }
  const platforms: LaunchBoxPlatformInfo[] = [];
  for (const row of root?.Platform ?? []) {
    const name = cleanText(row.Name, 200);
    if (!name) continue;
    const info: LaunchBoxPlatformInfo = { name, alternateNames: alternates.get(name) ?? [] };
    const releaseYear = cleanYear(row.ReleaseDate);
    if (releaseYear !== undefined) info.releaseYear = releaseYear;
    const texts = {
      manufacturer: cleanText(row.Manufacturer, LIMITS.manufacturer),
      cpu: cleanText(row.Cpu, LIMITS.cpu),
      ram: cleanText(row.Memory, LIMITS.ram),
      graphics: cleanText(row.Graphics, LIMITS.graphics),
      sound: cleanText(row.Sound, LIMITS.sound),
      display: cleanText(row.Display, LIMITS.display),
      media: cleanText(row.Media, LIMITS.media),
      notes: cleanText(row.Notes, LIMITS.description),
    };
    for (const [key, value] of Object.entries(texts)) {
      if (value !== undefined) Object.assign(info, { [key]: value });
    }
    platforms.push(info);
  }
  return platforms;
}

const FILLABLE = ['manufacturer', 'cpu', 'ram', 'graphics', 'sound', 'display', 'media'] as const;

/** Fills only fields `entry` lacks; adds the LaunchBox source when it filled description. */
export function fillFromLaunchBox(
  entry: SystemInfoEntry,
  lb: LaunchBoxPlatformInfo,
): SystemInfoEntry {
  const result: SystemInfoEntry = { ...entry };
  if (result.releaseYear === undefined && lb.releaseYear !== undefined) {
    result.releaseYear = lb.releaseYear;
  }
  for (const field of FILLABLE) {
    const value = lb[field];
    if (result[field] === undefined && value !== undefined) result[field] = value;
  }
  if (result.description === undefined && lb.notes !== undefined) {
    result.description = lb.notes;
    if (!result.sources.some((source) => source.name === LAUNCHBOX_SOURCE.name)) {
      result.sources = [...result.sources, LAUNCHBOX_SOURCE];
    }
  }
  return result;
}
