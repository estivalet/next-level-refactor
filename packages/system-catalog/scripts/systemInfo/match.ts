import type { SystemDefinition } from '@nextlevel/shared';

const squash = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * A source name → catalog system id: exact name, then alias, then launchboxPlatform; ignoring
 * case and punctuation. Null when nothing matches.
 */
export function matchSystemId(name: string, systems: readonly SystemDefinition[]): string | null {
  const wanted = squash(name);
  if (wanted === '') return null;
  const tiers: ((system: SystemDefinition) => readonly string[])[] = [
    (system) => [system.name],
    (system) => system.aliases,
    (system) => (system.scraper.launchboxPlatform ? [system.scraper.launchboxPlatform] : []),
  ];
  for (const candidates of tiers) {
    const hit = systems.find((system) => candidates(system).some((c) => squash(c) === wanted));
    if (hit) return hit.id;
  }
  return null;
}
