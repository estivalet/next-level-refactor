import type { ImportItem, LegacyMenuItem, MenuDocNode } from '@nextlevel/shared';
import type { LegacyFiles } from './readLegacy.ts';
import { Tally } from './tally.ts';

/**
 * An imported menu. Its collection nodes carry the collection **name** in `refId` until the
 * import binds them to the collections' ids (`bindCollections`).
 */
export interface MenuImport {
  file: string;
  source: string;
  title: string;
  nodes: MenuDocNode[];
  active: boolean;
}

const label = (value: string | undefined) => value?.trim().slice(0, 200) || null;

interface Context {
  match: (name: string) => string | null;
  collections: ReadonlySet<string>;
  newId: () => string;
  tally: Tally;
}

/** `display` (or the `disply` typo) when it differs from the name. */
function displayName(item: LegacyMenuItem): string | null {
  const shown = label(item.display ?? item.disply);
  return shown && shown !== item.name.trim() ? shown : null;
}

/** A system's filter children: `favorite` is the Favorites tab, the rest come from game tags. */
function systemFilterTabs(item: LegacyMenuItem, ctx: Context): boolean {
  const children = item.items ?? [];
  let tabs = false;
  for (const child of children) {
    if (child.filter === undefined) {
      ctx.tally.add('menu', `${item.name}: ${child.name}`, 'dropped');
      continue;
    }
    tabs = true;
    if (child.filter === 'favorite') ctx.tally.add('menu', item.name, 'favoriteFilterTab');
    if (child.items && child.items.length > 0) ctx.tally.add('menu', item.name, 'nestedFilterTab');
  }
  if (tabs) ctx.tally.add('menu', item.name, 'filterTabs');
  return tabs;
}

function node(
  item: LegacyMenuItem,
  type: MenuDocNode['type'],
  refId: string | null,
  ctx: Context,
  children: MenuDocNode[] = [],
  filterTabs = false,
): MenuDocNode {
  return {
    id: ctx.newId(),
    type,
    refId,
    name: item.name.trim().slice(0, 200) || 'Menu',
    displayName: displayName(item),
    shortName: label(item.shortname),
    filterTabs,
    visible: item.visible !== false,
    children,
  };
}

function mapItems(items: readonly LegacyMenuItem[], ctx: Context): MenuDocNode[] {
  const nodes: MenuDocNode[] = [];
  for (const item of items) {
    if (item.theme) ctx.tally.add('menu', item.name, 'themeOverride', item.theme);
    if (item.type === 'system') {
      const systemId = ctx.match(item.name);
      if (systemId)
        nodes.push(node(item, 'system', systemId, ctx, [], systemFilterTabs(item, ctx)));
      else ctx.tally.add('menu', item.name, 'unknownSystem');
    } else if (item.type === 'collection') {
      if (ctx.collections.has(item.name.toLowerCase())) {
        nodes.push(node(item, 'collection', item.name, ctx));
      } else {
        ctx.tally.add('menu', item.name, 'noGamelist');
      }
    } else if (item.type !== undefined) {
      ctx.tally.add('menu', item.name, 'dropped', item.type);
    } else if (item.filter !== undefined) {
      ctx.tally.add('menu', item.name, 'dropped', item.filter);
    } else if (item.items) {
      nodes.push(node(item, 'category', null, ctx, mapItems(item.items, ctx)));
    } else {
      ctx.tally.add('menu', item.name, 'untypedEntry');
    }
  }
  return nodes;
}

/**
 * NextLevelOS `menu*.json` → menu documents (FR-MENU-1..4, FR-IMP-1). Untyped nodes with children
 * are categories; a system's filter children turn its filter tabs on; untyped leaves, unknown
 * systems, collections without a gamelist and per-node themes (D9) are reported. The menu named
 * by config.json (default `menu.json`) is the active one.
 */
export function mapMenus(
  files: LegacyFiles,
  match: (name: string) => string | null,
  collectionNames: ReadonlySet<string>,
  newId: () => string,
): { menus: MenuImport[]; items: ImportItem[] } {
  const tally = new Tally();
  const ctx: Context = { match, collections: collectionNames, newId, tally };
  const activeFile = (files.config?.menu ?? 'menu.json').toLowerCase();
  const menus = files.menus.map(({ file, menu }) => ({
    file,
    source: `nextlevelos:${file}`,
    title: menu.title.trim().slice(0, 100) || file,
    nodes: mapItems(menu.items, ctx),
    active: file.toLowerCase() === activeFile,
  }));
  return { menus, items: tally.items() };
}

/** Collection nodes get the imported collections' ids; those without one are dropped. */
export function bindCollections(
  nodes: readonly MenuDocNode[],
  idsByName: ReadonlyMap<string, number>,
): MenuDocNode[] {
  return nodes.flatMap((n) => {
    if (n.type === 'collection') {
      const id = idsByName.get((n.refId ?? '').toLowerCase());
      return id === undefined ? [] : [{ ...n, refId: String(id) }];
    }
    return [{ ...n, children: bindCollections(n.children, idsByName) }];
  });
}
