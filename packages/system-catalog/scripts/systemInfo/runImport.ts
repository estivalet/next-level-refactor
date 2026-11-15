import type { SystemDefinition, SystemInfo, SystemInfoSeedFile } from '@nextlevel/shared';
import { fillFromLaunchBox, parseLaunchBoxPlatforms } from './launchboxXml.ts';
import { matchSystemId } from './match.ts';
import { emptyEntry, normalizeScraped, type SystemInfoEntry } from './normalize.ts';

// Scraped JSON files + LaunchBox Platforms.xml → the museum seed and a report (FR-MUS-1).
// Pure over its inputs so it is testable without the disk.

export const SEED_SOURCE = 'owner scrape 2026 + LaunchBox Metadata.xml';

export interface ImportReport {
  matched: number;
  unmatched: string[];
  unparseable: string[];
  dropped: Record<string, string[]>;
}

/** How many fields of an entry carry data; decides which of two duplicates is richer. */
function filledFields(entry: SystemInfoEntry): number {
  return Object.values(entry).filter((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  ).length;
}

export function runImport(
  files: { name: string; text: string }[],
  launchBoxXml: string | null,
  systems: readonly SystemDefinition[],
): { seed: SystemInfoSeedFile; report: ImportReport } {
  const report: ImportReport = { matched: 0, unmatched: [], unparseable: [], dropped: {} };
  const entries = new Map<string, { entry: SystemInfoEntry; file: string }>();

  for (const file of files) {
    const name = file.name.replace(/\.json$/i, '');
    let raw: unknown;
    try {
      raw = JSON.parse(file.text);
    } catch {
      report.unparseable.push(name);
      continue;
    }
    const systemId = matchSystemId(name, systems);
    if (systemId === null) {
      report.unmatched.push(name);
      continue;
    }
    const { entry, dropped } = normalizeScraped(raw);
    if (dropped.length > 0) report.dropped[name] = dropped;
    const existing = entries.get(systemId);
    if (existing === undefined) {
      entries.set(systemId, { entry, file: name });
    } else if (filledFields(entry) > filledFields(existing.entry)) {
      report.unmatched.push(`${existing.file} (duplicate of ${systemId})`);
      entries.set(systemId, { entry, file: name });
    } else {
      report.unmatched.push(`${name} (duplicate of ${systemId})`);
    }
  }

  if (launchBoxXml !== null) {
    for (const platform of parseLaunchBoxPlatforms(launchBoxXml)) {
      const systemId = [platform.name, ...platform.alternateNames]
        .map((candidate) => matchSystemId(candidate, systems))
        .find((id) => id !== null);
      if (systemId === undefined) continue;
      const current = entries.get(systemId) ?? { entry: emptyEntry(), file: platform.name };
      entries.set(systemId, { ...current, entry: fillFromLaunchBox(current.entry, platform) });
    }
  }

  const seedEntries: SystemInfo[] = [...entries.entries()]
    .filter(([, { entry }]) => filledFields(entry) > 0)
    .map(([systemId, { entry }]) => ({ systemId, ...entry }))
    .sort((a, b) => (a.systemId < b.systemId ? -1 : a.systemId > b.systemId ? 1 : 0));
  report.matched = seedEntries.length;
  return { seed: { source: SEED_SOURCE, entries: seedEntries }, report };
}
