import type { MenuDocNode } from '@nextlevel/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appErrorOf, tempLibrary } from '../library/testing.ts';
import { MenuRepository } from './MenuRepository.ts';

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 9, 22, 12, 0, tick++));

let library: Awaited<ReturnType<typeof tempLibrary>>;
let menus: MenuRepository;
beforeEach(async () => {
  library = await tempLibrary();
  menus = new MenuRepository(library.db, clock, uuidv7);
});
afterEach(async () => {
  await library.cleanup();
});

function node(name: string, patch: Partial<MenuDocNode> = {}): MenuDocNode {
  return {
    id: uuidv7(),
    type: 'category',
    refId: null,
    name,
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children: [],
    ...patch,
  };
}

const tree = () => [
  node('Nintendo', {
    displayName: 'NINTENDO',
    children: [
      node('Super Nintendo', { type: 'system', refId: 'snes', shortName: 'SNES' }),
      node('Picks', { type: 'collection', refId: '3', visible: false }),
    ],
  }),
  node('Sega', {
    children: [node('Saturn', { type: 'system', refId: 'saturn', filterTabs: false })],
  }),
];

describe('MenuRepository', () => {
  it('FR-MENU-1: a node id another menu uses is refused as invalid, nothing written', () => {
    const nodes = tree();
    const first = menus.create('Main', nodes);
    expect(appErrorOf(() => menus.create('Copy', nodes)).code).toBe('VALIDATION_FAILED');
    const other = menus.create('Other', []);
    expect(appErrorOf(() => menus.save(other.id, { title: 'Other', nodes }, 0)).code).toBe(
      'VALIDATION_FAILED',
    );
    expect(menus.list().map((menu) => menu.title)).toEqual(['Main', 'Other']);
    expect(menus.get(other.id).revision).toBe(0);
    expect(menus.get(first.id).nodes).toEqual(nodes);
  });

  it('FR-MENU-3: no menus means no active menu', () => {
    expect(menus.list()).toEqual([]);
    expect(menus.active()).toBeNull();
  });

  it('FR-MENU-1: a created menu reads back as the same tree, and the first one is active', () => {
    const nodes = tree();
    const created = menus.create('Main', nodes);
    expect(created).toMatchObject({ title: 'Main', revision: 0, active: true, source: null });
    expect(menus.get(created.id).nodes).toEqual(nodes);
    const other = menus.create('Kids', []);
    expect(other.active).toBe(false);
    expect(menus.list().map((menu) => [menu.title, menu.active, menu.nodeCount])).toEqual([
      ['Kids', false, 0],
      ['Main', true, 5],
    ]);
  });

  it('FR-MENU-1: saving replaces the tree and bumps the revision; a stale save is refused', () => {
    const created = menus.create('Main', tree());
    const [nintendo, sega] = created.nodes;
    if (!nintendo || !sega) throw new Error('fixture');
    const saturn = sega.children[0];
    if (!saturn) throw new Error('fixture');
    const moved = [{ ...nintendo, children: [...nintendo.children, saturn] }];
    const saved = menus.save(created.id, { title: 'Main 2', nodes: moved }, 0);
    expect(saved.revision).toBe(1);
    expect(menus.get(created.id)).toMatchObject({ title: 'Main 2', nodes: moved });
    expect(appErrorOf(() => menus.save(created.id, { title: 'X', nodes: [] }, 0)).code).toBe(
      'CONFLICT',
    );
    expect(menus.get(created.id).title).toBe('Main 2');
  });

  it('FR-MENU-3: one menu is active; deleting it activates the most recently changed other', () => {
    const main = menus.create('Main', []);
    const kids = menus.create('Kids', []);
    const arcade = menus.create('Arcade', []);
    menus.save(kids.id, { title: 'Kids', nodes: [] }, 0);
    menus.setActive(arcade.id);
    expect(menus.active()?.id).toBe(arcade.id);
    expect(menus.get(main.id).active).toBe(false);
    menus.delete(arcade.id);
    expect(menus.active()?.id).toBe(kids.id);
    menus.delete(kids.id);
    menus.delete(main.id);
    expect(menus.active()).toBeNull();
    expect(
      appErrorOf(() => {
        menus.delete(main.id);
      }).code,
    ).toBe('NOT_FOUND');
    expect(
      appErrorOf(() => {
        menus.setActive(main.id);
      }).code,
    ).toBe('NOT_FOUND');
  });

  it('D12: an imported menu is replaced in place by source', () => {
    const first = menus.upsertBySource('nextlevelos:menu.json', 'Imported', tree());
    const again = menus.upsertBySource('nextlevelos:menu.json', 'Imported', [node('Only')]);
    expect(again.id).toBe(first.id);
    expect(again.revision).toBe(1);
    expect(again.source).toBe('nextlevelos:menu.json');
    expect(menus.list()).toHaveLength(1);
    expect(menus.get(first.id).nodes.map((n) => n.name)).toEqual(['Only']);
  });
});
