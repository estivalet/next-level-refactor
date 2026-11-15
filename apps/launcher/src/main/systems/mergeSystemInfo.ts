import type { CustomSystem, SystemDefinition, SystemInfo } from '@nextlevel/shared';
import { systemInfoSeed } from '@nextlevel/system-catalog';

/**
 * The entry before any local edit (FR-MUS-1): the shipped seed, or for a custom system the facts
 * its settings already hold (manufacturer, release year, description); else just the id.
 */
export function baseSystemInfo(
  system: SystemDefinition,
  custom: CustomSystem | undefined,
): SystemInfo {
  const seed = systemInfoSeed(system.id);
  if (seed) return seed;
  const entry: SystemInfo = {
    systemId: system.id,
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
