import type { MenuNode, MenuTree } from '@nextlevel/shared';

export interface MenuTreeInput {
  systems: ReadonlyArray<{
    id: string;
    name: string;
    shortName?: string | undefined;
    manufacturer?: string | undefined;
  }>;
  /** Present (non-missing) games per system id. */
  gameCounts: ReadonlyMap<string, number>;
  /** Distinct filters of each system's present games. */
  filtersBySystem: ReadonlyMap<string, readonly string[]>;
  collections: ReadonlyArray<{ id: number; name: string }>;
}

/** A system's favorites, offered like a filter tag although favorite is a flag on the game. */
export const FAVORITE_FILTER = 'favorite';

/** Filters with a translated name (`frontend.filters.<slug>`); others show their slug. */
const KNOWN_FILTERS = new Set([
  FAVORITE_FILTER,
  'official',
  'homebrew',
  'hack',
  'translation',
  'prototype',
  'unlicensed',
]);

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

const readable = (filter: string) => {
  const words = filter.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A system's filter entries (≥ 2 distinct filters, `official` first); ids hang off `baseId`. */
export function filterNodes(
  system: { id: string; name: string },
  filters: readonly string[],
  baseId = `s:${system.id}`,
): MenuNode[] {
  if (filters.length < 2) return [];
  const ordered = [...filters].sort((a, b) =>
    a === 'official' ? -1 : b === 'official' ? 1 : a.localeCompare(b),
  );
  return ordered.map((filter) => ({
    id: `${baseId}:f:${filter}`,
    // A filter's games show its system's art; its own logo is found by `display` (logoNames).
    name: system.name,
    display: readable(filter),
    ...(KNOWN_FILTERS.has(filter) ? { labelKey: `frontend.filters.${filter}` } : {}),
    type: 'filter' as const,
    systemId: system.id,
    filter,
    children: [],
  }));
}

/**
 * The generated menu used until menus arrive in M5 (FR-MENU-3): manufacturer categories (sorted,
 * "Other" last) with their systems that have games, each with filter entries when its games
 * carry two or more filters, then a Collections category.
 */
export function buildMenuTree(input: MenuTreeInput): MenuTree {
  const groups = new Map<string, MenuNode>();
  const systems = input.systems.filter((system) => (input.gameCounts.get(system.id) ?? 0) > 0);
  for (const system of [...systems].sort(byName)) {
    const maker = system.manufacturer ?? null;
    const id = maker ? `m:${slug(maker)}` : 'm:other';
    let group = groups.get(id);
    if (!group) {
      group = maker
        ? { id, name: maker, display: maker, type: 'category', children: [] }
        : {
            id,
            name: 'Other',
            display: 'Other',
            labelKey: 'frontend.menu.other',
            type: 'category',
            children: [],
          };
      groups.set(id, group);
    }
    group.children.push({
      id: `s:${system.id}`,
      name: system.name,
      display: system.name,
      ...(system.shortName ? { shortName: system.shortName } : {}),
      type: 'system',
      systemId: system.id,
      children: filterNodes(system, input.filtersBySystem.get(system.id) ?? []),
    });
  }
  const other = groups.get('m:other');
  groups.delete('m:other');
  const items = [...groups.values()].sort(byName);
  if (other) items.push(other);
  if (input.collections.length > 0) {
    items.push({
      id: 'm:collections',
      name: 'Collections',
      display: 'Collections',
      labelKey: 'frontend.menu.collections',
      type: 'category',
      children: input.collections.map((collection) => ({
        id: `c:${String(collection.id)}`,
        name: collection.name,
        display: collection.name,
        type: 'collection',
        collectionId: collection.id,
        children: [],
      })),
    });
  }
  return { title: 'NextLevel', items };
}
