import {
  err,
  ok,
  walkMenuNodes,
  type CollectionSummary,
  type MenuDocNode,
  type MenuDocument,
  type MenuDraft,
  type SmartFilterSummary,
  type SystemDefinition,
  type SystemSummary,
} from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import type { FakeResponses } from '../../test-utils.tsx';

export function docNode(
  name: string,
  type: MenuDocNode['type'] = 'category',
  children: MenuDocNode[] = [],
  extra: Partial<MenuDocNode> = {},
): MenuDocNode {
  return {
    id: uuidv7(),
    type,
    refId: type === 'category' ? null : name.toLowerCase().replace(/\s+/g, '-'),
    name,
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children,
    ...extra,
  };
}

/** Nintendo › Super Nintendo; Sega; Sega Saturn — the generated-looking default menu. */
export function sampleNodes(): MenuDocNode[] {
  return [
    docNode('Nintendo', 'category', [docNode('Super Nintendo', 'system', [], { refId: 'snes' })]),
    docNode('Sega', 'category', [docNode('Sega Genesis', 'system', [], { refId: 'genesis' })]),
    docNode('Sega Saturn', 'system', [], { refId: 'saturn' }),
  ];
}

/**
 * Main's menu channels kept in memory: revisions, one active menu, the generated draft while
 * nothing is stored, CONFLICT on a stale save and VALIDATION_FAILED on reused node ids.
 */
export function menusFake(
  stored: MenuDocument[] = [],
  generated: () => MenuDraft = () => ({
    title: 'Default',
    nodes: sampleNodes(),
  }),
) {
  const menus = new Map(stored.map((menu) => [menu.id, structuredClone(menu)]));
  const draftId = uuidv7();
  const draft = { ...generated(), id: draftId, revision: 0, active: true, source: null };
  const list = () =>
    [...menus.values()]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(({ nodes, ...rest }) => ({ ...rest, nodeCount: [...walkMenuNodes(nodes)].length }));
  const usedIds = (except: string) =>
    new Set(
      [...menus.values()]
        .filter((menu) => menu.id !== except)
        .flatMap((menu) => [...walkMenuNodes(menu.nodes)].map((node) => node.id)),
    );
  const reused = (menuId: string, nodes: MenuDocNode[]) => {
    const used = usedIds(menuId);
    return [...walkMenuNodes(nodes)].some((node) => used.has(node.id));
  };
  const invalid = err('VALIDATION_FAILED', 'errors.validationFailed');
  const responses: FakeResponses = {
    'menus.list': () => ok(list()),
    'menus.get': ({ id }) => {
      const menu = menus.get(id);
      return menu ? ok(structuredClone(menu)) : err('NOT_FOUND', 'errors.notFound');
    },
    'menus.draft': () => {
      const active = [...menus.values()].find((menu) => menu.active);
      return ok(structuredClone(active ?? draft));
    },
    'menus.generated': () => ok(generated()),
    'menus.create': ({ title, nodes }) => {
      const id = uuidv7();
      if (reused(id, nodes)) return invalid;
      const menu = { id, title, nodes, revision: 0, active: menus.size === 0, source: null };
      menus.set(id, menu);
      return ok(structuredClone(menu));
    },
    'menus.save': ({ id, title, nodes, baseRevision }) => {
      const menu = menus.get(id);
      if (!menu) return err('NOT_FOUND', 'errors.notFound');
      if (menu.revision !== baseRevision) {
        return err('CONFLICT', 'errors.conflict');
      }
      if (reused(id, nodes)) return invalid;
      Object.assign(menu, { title, nodes, revision: menu.revision + 1 });
      return ok(structuredClone(menu));
    },
    'menus.delete': ({ id }) => {
      menus.delete(id);
      return ok(undefined);
    },
    'menus.setActive': ({ id }) => {
      for (const menu of menus.values()) menu.active = menu.id === id;
      return ok(undefined);
    },
  };
  /** Another window saved the menu: bumps its revision. */
  const bump = (id: string) => {
    const menu = menus.get(id);
    if (menu) menu.revision += 1;
  };
  return { responses, menus, bump };
}

export function storedMenu(title: string, nodes: MenuDocNode[], active = false): MenuDocument {
  return { id: uuidv7(), title, nodes, revision: 3, active, source: null };
}

const SYSTEM: SystemDefinition = {
  id: 'snes',
  name: 'Super Nintendo',
  manufacturer: 'Nintendo',
  kind: 'console',
  extensions: ['sfc'],
  defaultFolderName: 'Super Nintendo',
  scraper: {},
  presetProfiles: [],
  aliases: [],
};

export const REF_CATALOG: SystemDefinition[] = [
  SYSTEM,
  { ...SYSTEM, id: 'nintendo-64', name: 'Nintendo 64', defaultFolderName: 'Nintendo 64' },
  { ...SYSTEM, id: 'genesis', name: 'Sega Genesis', manufacturer: 'Sega' },
];

/** What menu nodes can point at: every REF_CATALOG system enabled with 5 games by default. */
export function refsResponses({
  systems = REF_CATALOG.map((s) => ({ id: s.id, enabled: true, games: 5, missing: 0, review: 0 })),
  collections = [],
  smartFilters = [],
}: {
  systems?: SystemSummary[];
  collections?: CollectionSummary[];
  smartFilters?: SmartFilterSummary[];
} = {}): FakeResponses {
  return {
    'systems.catalog': () => ok(REF_CATALOG),
    'systems.list': () => ok(systems),
    'collections.list': () => ok(collections),
    'smartFilters.list': () => ok(smartFilters),
  };
}
