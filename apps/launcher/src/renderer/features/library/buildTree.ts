import {
  walkMenuNodes,
  type CollectionSummary,
  type MenuDocNode,
  type SmartFilterSummary,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';

/** Group key and label for systems without a manufacturer; the tree shows it translated. */
export const OTHER_GROUP = '\u0000other';
/** Group key and label for systems with games the active menu leaves out; shown translated. */
export const NOT_IN_MENU_GROUP = '\u0000notInMenu';

/** `depth` counts the groups a row sits in; a group's own depth is its nesting level. */
export type TreeRow =
  | { kind: 'group'; key: string; label: string; expanded: boolean; depth: number }
  | {
      kind: 'system';
      systemId: string;
      label: string;
      games: number;
      missing: number;
      depth: number;
    }
  | { kind: 'collectionsHeader' }
  | { kind: 'collection'; collection: CollectionSummary; label?: string; depth: number }
  | { kind: 'smartFiltersHeader' }
  | { kind: 'smartFilter'; filter: SmartFilterSummary; label?: string; depth: number };

type SystemRow = Extract<TreeRow, { kind: 'system' }>;

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The Library's left tree (S7): systems that have games laid out like the active menu (FR-MENU-3)
 * — its categories, order, names and hidden nodes — with the systems it leaves out in a last
 * "not in menu" group; then the collections and smart filters (FR-LIB-9) the menu doesn't show
 * (hidden ones included, so they can still be managed). With no menu
 * (still loading) systems are grouped by manufacturer, others last. Collapsed groups keep their
 * header only; empty categories are left out.
 */
export function buildTree(
  systems: readonly SystemSummary[],
  catalog: readonly SystemDefinition[],
  menu: readonly MenuDocNode[] | null,
  collections: readonly CollectionSummary[],
  smartFilters: readonly SmartFilterSummary[],
  collapsed: ReadonlySet<string>,
): TreeRow[] {
  const definitions = new Map(catalog.map((system) => [system.id, system]));
  const withGames = new Map(systems.filter((s) => s.games > 0).map((s) => [s.id, s]));
  const systemRow = (summary: SystemSummary, depth: number, label?: string): SystemRow => ({
    kind: 'system',
    systemId: summary.id,
    label: label ?? definitions.get(summary.id)?.name ?? summary.id,
    games: summary.games,
    missing: summary.missing,
    depth,
  });
  const pushGroup = (rows: TreeRow[], key: string, label: string, children: TreeRow[]) => {
    const expanded = !collapsed.has(key);
    rows.push({ kind: 'group', key, label, expanded, depth: 0 });
    if (expanded) rows.push(...children);
  };

  const rows: TreeRow[] = [];
  // Collections and smart filters the menu shows (even in a collapsed category) aren't repeated.
  const shown = new Set<string>();
  if (menu) {
    const collectionsById = new Map(collections.map((c) => [String(c.id), c]));
    const filtersById = new Map(smartFilters.map((f) => [String(f.id), f]));
    const menuRows = (nodes: readonly MenuDocNode[], depth: number): TreeRow[] => {
      const out: TreeRow[] = [];
      for (const node of nodes) {
        if (!node.visible) continue;
        const label = node.displayName ?? undefined;
        if (node.type === 'category') {
          const children = menuRows(node.children, depth + 1);
          if (children.length === 0) continue;
          const key = `m:${node.id}`;
          const expanded = !collapsed.has(key);
          out.push({ kind: 'group', key, label: label ?? node.name, expanded, depth });
          if (expanded) out.push(...children);
        } else if (node.type === 'system') {
          const summary = withGames.get(node.refId ?? '');
          if (summary) out.push(systemRow(summary, depth, label));
        } else if (node.type === 'collection') {
          const collection = collectionsById.get(node.refId ?? '');
          if (collection) {
            shown.add(`c:${String(collection.id)}`);
            out.push({ kind: 'collection', collection, depth, ...(label ? { label } : {}) });
          }
        } else {
          const filter = filtersById.get(node.refId ?? '');
          if (filter) {
            shown.add(`sf:${String(filter.id)}`);
            out.push({ kind: 'smartFilter', filter, depth, ...(label ? { label } : {}) });
          }
        }
      }
      return out;
    };
    rows.push(...menuRows(menu, 0));
    // Hidden systems count as placed: hiding one in the menu hides it here too.
    const placed = new Set<string>();
    for (const node of walkMenuNodes(menu)) {
      if (node.type === 'system' && node.refId) placed.add(node.refId);
    }
    const left = [...withGames.values()]
      .filter((summary) => !placed.has(summary.id))
      .map((summary) => systemRow(summary, 1))
      .sort((a, b) => byName(a.label, b.label));
    if (left.length > 0) pushGroup(rows, NOT_IN_MENU_GROUP, NOT_IN_MENU_GROUP, left);
  } else {
    const groups = new Map<string, SystemRow[]>();
    for (const summary of withGames.values()) {
      const key = definitions.get(summary.id)?.manufacturer ?? OTHER_GROUP;
      groups.set(key, [...(groups.get(key) ?? []), systemRow(summary, 1)]);
    }
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === OTHER_GROUP) return 1;
      if (b === OTHER_GROUP) return -1;
      return byName(a, b);
    });
    for (const key of keys) {
      pushGroup(
        rows,
        key,
        key,
        (groups.get(key) ?? []).sort((a, b) => byName(a.label, b.label)),
      );
    }
  }
  rows.push({ kind: 'collectionsHeader' });
  for (const collection of collections) {
    if (!shown.has(`c:${String(collection.id)}`)) {
      rows.push({ kind: 'collection', collection, depth: 1 });
    }
  }
  rows.push({ kind: 'smartFiltersHeader' });
  for (const filter of smartFilters) {
    if (!shown.has(`sf:${String(filter.id)}`)) rows.push({ kind: 'smartFilter', filter, depth: 1 });
  }
  return rows;
}
