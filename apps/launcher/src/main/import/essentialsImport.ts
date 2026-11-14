import { isEssentialsName, type ImportItem } from '@nextlevel/shared';
import type { CollectionImport } from './mapCollections.ts';

/**
 * D63: with Essentials collections only, the collections that aren't Essentials are left out and
 * reported `notEssentials`; their menu nodes are dropped when the menus are bound
 * (bindCollections). Without the option, every collection stays.
 */
export function essentialsOnly<T extends { collections: CollectionImport[] }>(
  mapped: T,
  only: boolean | undefined,
): { kept: T; dropped: ReadonlySet<string>; items: ImportItem[] } {
  const left = only ? mapped.collections.filter((c) => !isEssentialsName(c.name)) : [];
  return {
    kept: { ...mapped, collections: mapped.collections.filter((c) => !left.includes(c)) },
    dropped: new Set(left.map((c) => c.name)),
    items: left.map((c): ImportItem => ({
      area: 'collection',
      key: c.name,
      reason: 'notEssentials',
      ...(c.entries.length > 0 ? { count: c.entries.length } : {}),
    })),
  };
}
