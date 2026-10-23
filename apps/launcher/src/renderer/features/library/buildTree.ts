import type {
  CollectionSummary,
  SmartFilterSummary,
  SystemDefinition,
  SystemSummary,
} from '@nextlevel/shared';

/** Group key and label for systems without a manufacturer; the tree shows it translated. */
export const OTHER_GROUP = '\u0000other';

export type TreeRow =
  | { kind: 'group'; key: string; label: string; expanded: boolean }
  | { kind: 'system'; systemId: string; label: string; games: number; missing: number }
  | { kind: 'collectionsHeader' }
  | { kind: 'collection'; collection: CollectionSummary }
  | { kind: 'smartFiltersHeader' }
  | { kind: 'smartFilter'; filter: SmartFilterSummary };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The Library's left tree (S7): systems that have games, grouped by manufacturer (others last),
 * then the collections, then the smart filters (FR-LIB-9). Collapsed groups keep their header only.
 */
export function buildTree(
  systems: readonly SystemSummary[],
  catalog: readonly SystemDefinition[],
  collections: readonly CollectionSummary[],
  smartFilters: readonly SmartFilterSummary[],
  collapsed: ReadonlySet<string>,
): TreeRow[] {
  const definitions = new Map(catalog.map((system) => [system.id, system]));
  const groups = new Map<string, Array<Extract<TreeRow, { kind: 'system' }>>>();
  for (const summary of systems) {
    if (summary.games === 0) continue;
    const definition = definitions.get(summary.id);
    const key = definition?.manufacturer ?? OTHER_GROUP;
    const rows = groups.get(key) ?? [];
    rows.push({
      kind: 'system',
      systemId: summary.id,
      label: definition?.name ?? summary.id,
      games: summary.games,
      missing: summary.missing,
    });
    groups.set(key, rows);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === OTHER_GROUP) return 1;
    if (b === OTHER_GROUP) return -1;
    return byName(a, b);
  });
  const rows: TreeRow[] = [];
  for (const key of keys) {
    const expanded = !collapsed.has(key);
    rows.push({ kind: 'group', key, label: key, expanded });
    if (expanded) {
      rows.push(...(groups.get(key) ?? []).sort((a, b) => byName(a.label, b.label)));
    }
  }
  rows.push({ kind: 'collectionsHeader' });
  for (const collection of collections) rows.push({ kind: 'collection', collection });
  rows.push({ kind: 'smartFiltersHeader' });
  for (const filter of smartFilters) rows.push({ kind: 'smartFilter', filter });
  return rows;
}
