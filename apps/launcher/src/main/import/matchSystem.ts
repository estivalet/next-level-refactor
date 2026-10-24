import type { SystemDefinition } from '@nextlevel/shared';

/** "Sony PlayStation", "sony-playstation" and "SONY PLAYSTATION " all give "sonyplaystation". */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A NextLevelOS system name → catalog id (FR-IMP-1): exact name, then an alias (the catalog keeps
 * each system's NextLevelOS name), then a case- and punctuation-insensitive match. Built once for
 * the ~200k names an import looks up.
 */
export function createSystemMatcher(
  catalog: readonly SystemDefinition[],
): (name: string) => string | null {
  const exact = new Map<string, string>();
  const loose = new Map<string, string>();
  for (const system of catalog) exact.set(system.name, system.id);
  for (const system of catalog) {
    for (const alias of system.aliases) if (!exact.has(alias)) exact.set(alias, system.id);
  }
  for (const [name, id] of exact) if (!loose.has(slug(name))) loose.set(slug(name), id);
  for (const system of catalog)
    if (!loose.has(slug(system.id))) loose.set(slug(system.id), system.id);
  return (name) => exact.get(name) ?? (slug(name) ? (loose.get(slug(name)) ?? null) : null);
}

export function matchSystem(name: string, catalog: readonly SystemDefinition[]): string | null {
  return createSystemMatcher(catalog)(name);
}
