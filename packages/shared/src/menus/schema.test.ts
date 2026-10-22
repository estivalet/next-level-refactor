import { describe, expect, it } from 'vitest';
import { MenuDocNodeSchema, MenuDraftSchema, MAX_MENU_NODES, type MenuDocNode } from './schema.ts';

let next = 0;
const uuid = () => `0192f000-0000-7000-8000-${String(next++).padStart(12, '0')}`;

function node(patch: Partial<MenuDocNode> = {}): MenuDocNode {
  return {
    id: uuid(),
    type: 'category',
    refId: null,
    name: 'Nintendo',
    displayName: null,
    shortName: null,
    filterTabs: true,
    visible: true,
    children: [],
    ...patch,
  };
}

const draft = (nodes: MenuDocNode[]) => MenuDraftSchema.safeParse({ title: 'Main', nodes });

describe('menu document contracts', () => {
  it('FR-MENU-2: only categories have children', () => {
    const system = node({ type: 'system', refId: 'snes', children: [node()] });
    expect(draft([system]).success).toBe(false);
  });

  it('FR-MENU-2: a category has no reference and a reference has a target', () => {
    expect(draft([node({ refId: 'snes' })]).success).toBe(false);
    expect(draft([node({ type: 'system', refId: null })]).success).toBe(false);
    expect(draft([node({ type: 'system', refId: 'snes' })]).success).toBe(true);
  });

  it('FR-MENU-2: collection and smart filter targets are positive integer ids', () => {
    expect(draft([node({ type: 'collection', refId: '0' })]).success).toBe(false);
    expect(draft([node({ type: 'collection', refId: 'abc' })]).success).toBe(false);
    expect(draft([node({ type: 'smartFilter', refId: '12' })]).success).toBe(true);
  });

  it('FR-MENU-2: node ids are unique across the menu', () => {
    const a = node();
    const b = node({ children: [{ ...node(), id: a.id }] });
    expect(draft([a, b]).success).toBe(false);
  });

  it('FR-MENU-1: categories nest without a fixed depth limit', () => {
    let deep = node({ type: 'system', refId: 'snes' });
    for (let i = 0; i < 10; i++) deep = node({ children: [deep] });
    expect(draft([deep]).success).toBe(true);
  });

  it(`FR-MENU-1: a menu holds at most ${String(MAX_MENU_NODES)} nodes`, () => {
    const many = Array.from({ length: MAX_MENU_NODES + 1 }, () => node());
    expect(draft(many).success).toBe(false);
    expect(draft(many.slice(1)).success).toBe(true);
  });

  it('FR-MENU-4: filter tabs and visibility default on; names are bounded', () => {
    const parsed = MenuDocNodeSchema.parse({
      id: uuid(),
      type: 'category',
      refId: null,
      name: 'Sega',
      displayName: null,
      shortName: null,
      children: [],
    });
    expect(parsed.filterTabs).toBe(true);
    expect(parsed.visible).toBe(true);
    expect(draft([node({ name: '' })]).success).toBe(false);
    expect(MenuDraftSchema.safeParse({ title: '', nodes: [] }).success).toBe(false);
  });
});
