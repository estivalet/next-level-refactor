import { SystemInfoSeedFileSchema, type SystemInfo } from '@nextlevel/shared';
import data from '../data/system-info.json' with { type: 'json' };

let cache: ReadonlyMap<string, SystemInfo> | undefined;

function seed(): ReadonlyMap<string, SystemInfo> {
  cache ??= new Map(
    SystemInfoSeedFileSchema.parse(data).entries.map((entry) => [entry.systemId, entry]),
  );
  return cache;
}

/** The shipped museum entry for a system, validated once (FR-MUS-1). */
export function systemInfoSeed(systemId: string): SystemInfo | undefined {
  return seed().get(systemId);
}

/** Ids of every system the shipped seed has an entry for. */
export function systemInfoSeedIds(): readonly string[] {
  return [...seed().keys()];
}
