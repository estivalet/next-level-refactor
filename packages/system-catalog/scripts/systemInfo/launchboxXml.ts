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

const LAUNCHBOX_SOURCE = 'LaunchBox Games Database';

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
      manufacturer: cleanText(row.Manufacturer, 200),
      cpu: cleanText(row.Cpu, 300),
      ram: cleanText(row.Memory, 300),
      graphics: cleanText(row.Graphics, 300),
      sound: cleanText(row.Sound, 300),
      display: cleanText(row.Display, 300),
      media: cleanText(row.Media, 300),
      notes: cleanText(row.Notes, 20000),
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
    if (!result.sources.some((source) => source.name === LAUNCHBOX_SOURCE)) {
      result.sources = [...result.sources, { name: LAUNCHBOX_SOURCE }];
    }
  }
  return result;
}
