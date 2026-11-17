import type { CustomSystem, SystemDefinition, SystemInfo } from '@nextlevel/shared';
import { systemInfoSeed } from '@nextlevel/system-catalog';

/**
 * The entry before any local edit (FR-MUS-1): the shipped seed, or for a custom system the facts
 * its settings already hold (manufacturer, release year, description); else just the id. It always
 * carries the system's shipped kind (FR-MUS-10).
 */
export function baseSystemInfo(
  system: SystemDefinition,
  custom: CustomSystem | undefined,
): SystemInfo {
  const seed = systemInfoSeed(system.id);
  if (seed) return { ...seed, kind: system.kind };
  const entry: SystemInfo = {
    systemId: system.id,
    kind: system.kind,
    models: [],
    peripherals: [],
    topGames: [],
    sources: [],
  };
  if (custom?.manufacturer) entry.manufacturer = custom.manufacturer;
  if (custom?.releaseYear !== undefined) entry.releaseYear = custom.releaseYear;
  if (custom?.description) entry.description = custom.description;
  return entry;
}
