import {
  MenuDraftSchema,
  SyncMenuSchema,
  type MenuDocNode,
  type MenuDocument,
} from '@nextlevel/shared';
import type { LibraryDb } from '../library/openLibrary.ts';
import type { MenuRepository } from '../menus/MenuRepository.ts';
import type { KindAdapter } from './documents.ts';
import { liveValue } from './merge.ts';

const ACTIVE = 'active';

/** An imported menu is the same menu on every PC that imported it (D12); others go by id. */
const keyOf = (menu: Pick<MenuDocument, 'id' | 'source'>) =>
  menu.source === null ? `menu:${menu.id}` : `menu:s:${menu.source}`;

const isRef = (type: unknown): type is 'collection' | 'smartFilter' =>
  type === 'collection' || type === 'smartFilter';

function syncIds(db: LibraryDb, table: 'collections' | 'smart_filters') {
  const rows = db.$client
    .prepare(`select id, sync_id as syncId from ${table} where sync_id is not null`)
    .all() as Array<{ id: number; syncId: string }>;
  return {
    toSync: new Map(rows.map((row) => [String(row.id), row.syncId])),
    toLocal: new Map(rows.map((row) => [row.syncId, String(row.id)])),
  };
}

type Maps = Record<'collection' | 'smartFilter', Map<string, string>>;

/** Collection and smart filter nodes name their target by sync id in the document. */
function translate(nodes: readonly MenuDocNode[], maps: Maps): MenuDocNode[] {
  return nodes.map((node) => ({
    ...node,
    refId:
      (node.type === 'collection' || node.type === 'smartFilter') && node.refId !== null
        ? (maps[node.type].get(node.refId) ?? null)
        : node.refId,
    children: translate(node.children, maps),
  }));
}

/** Back to this PC's ids; a node whose target this PC doesn't have is left out. */
function untranslate(nodes: readonly unknown[], maps: Maps): unknown[] {
  const result: unknown[] = [];
  for (const raw of nodes) {
    if (typeof raw !== 'object' || raw === null) continue;
    const node = raw as Record<string, unknown>;
    const type = node['type'];
    let refId = node['refId'];
    if (isRef(type)) {
      refId = typeof refId === 'string' ? maps[type].get(refId) : undefined;
      if (refId === undefined) continue;
    }
    const children = Array.isArray(node['children']) ? untranslate(node['children'], maps) : [];
    result.push({ ...node, refId, children });
  }
  return result;
}

export interface MenusDocDeps {
  db: LibraryDb;
  menus: MenuRepository;
  newId: () => string;
  /** A menu changed (menus.changed). */
  changed: () => void;
  log: { warn(context: object, msg: string): void };
}

/**
 * The `menus` document (D55): one entry per menu (its title and whole tree) and `active`, the
 * active menu's key. Synced after `collections`, so every collection a menu names is here.
 */
export function menusDoc(deps: MenusDocDeps): KindAdapter {
  const maps = (direction: 'toSync' | 'toLocal'): Maps => ({
    collection: syncIds(deps.db, 'collections')[direction],
    smartFilter: syncIds(deps.db, 'smart_filters')[direction],
  });
  return {
    read() {
      const toSync = maps('toSync');
      const values = new Map<string, unknown>();
      for (const summary of deps.menus.list()) {
        const menu = deps.menus.get(summary.id);
        values.set(keyOf(menu), {
          id: menu.source === null ? menu.id : null,
          title: menu.title,
          source: menu.source,
          nodes: translate(menu.nodes, toSync),
        });
        if (menu.active) values.set(ACTIVE, keyOf(menu));
      }
      return {
        view: { values, holds: () => true, subject: () => null },
        present: () => true,
        hasSubject: () => false,
      };
    },
    apply(merged, keys) {
      if (keys.length === 0) return;
      const toLocal = maps('toLocal');
      const localIds = () =>
        new Map(deps.menus.list().map((menu) => [keyOf(menu), menu.id] as const));
      const here = localIds();
      for (const key of keys) {
        if (!key.startsWith('menu:')) continue;
        const localId = here.get(key) ?? null;
        const value = liveValue(merged[key]);
        try {
          if (value === undefined) {
            if (localId !== null) deps.menus.delete(localId);
            continue;
          }
          const menu = SyncMenuSchema.parse(value);
          const draft = MenuDraftSchema.parse({
            title: menu.title,
            nodes: untranslate(menu.nodes, toLocal),
          });
          deps.menus.putSynced(localId, { ...menu, id: menu.id ?? deps.newId() }, draft.nodes);
        } catch (error) {
          deps.log.warn({ error }, 'a synced menu was not applied');
        }
      }
      const active = liveValue(merged[ACTIVE]);
      if (keys.includes(ACTIVE) && typeof active === 'string') {
        const id = localIds().get(active);
        if (id !== undefined) deps.menus.setActive(id);
      }
      deps.changed();
    },
  };
}
