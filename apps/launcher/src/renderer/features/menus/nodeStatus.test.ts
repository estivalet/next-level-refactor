import { describe, expect, it } from 'vitest';
import { addReference, nodeStatus, notInMenu, type MenuRefs } from './nodeStatus.ts';
import { docNode } from './testing.ts';
import { findNode } from './treeOps.ts';

const refs: MenuRefs = {
  systems: new Map([
    ['snes', { name: 'Super Nintendo', manufacturer: 'Nintendo', enabled: true, games: 3 }],
    ['n64', { name: 'Nintendo 64', manufacturer: 'Nintendo', enabled: true, games: 2 }],
    ['genesis', { name: 'Sega Genesis', manufacturer: 'Sega', enabled: false, games: 5 }],
    ['saturn', { name: 'Sega Saturn', manufacturer: 'Sega', enabled: true, games: 0 }],
  ]),
  collections: new Map([
    [1, { name: 'Picks', games: 4 }],
    [2, { name: 'Empty list', games: 0 }],
  ]),
  smartFilters: new Map([[7, { name: 'Favorites', games: 1 }]]),
};

const system = (refId: string) => docNode(refId, 'system', [], { refId });

describe('FR-MENU-2 nodeStatus', () => {
  it('follows the resolver: disabled, no games, deleted, empty', () => {
    expect(nodeStatus(system('snes'), refs)).toBe('ok');
    expect(nodeStatus(system('genesis'), refs)).toBe('systemDisabled');
    expect(nodeStatus(system('saturn'), refs)).toBe('noGames');
    expect(nodeStatus(system('gone'), refs)).toBe('missingRef');
    expect(nodeStatus(docNode('Picks', 'collection', [], { refId: '1' }), refs)).toBe('ok');
    expect(nodeStatus(docNode('E', 'collection', [], { refId: '2' }), refs)).toBe('noGames');
    expect(nodeStatus(docNode('X', 'collection', [], { refId: '9' }), refs)).toBe('missingRef');
    expect(nodeStatus(docNode('F', 'smartFilter', [], { refId: '7' }), refs)).toBe('ok');
    expect(nodeStatus(docNode('G', 'smartFilter', [], { refId: '8' }), refs)).toBe('missingRef');
  });

  it('a category is empty when nothing below it can open', () => {
    expect(nodeStatus(docNode('Sega', 'category', [system('saturn')]), refs)).toBe('empty');
    expect(nodeStatus(docNode('None', 'category'), refs)).toBe('empty');
    const hidden = docNode('Hidden', 'category', [{ ...system('snes'), visible: false }]);
    expect(nodeStatus(hidden, refs)).toBe('empty');
    expect(nodeStatus(docNode('N', 'category', [system('snes')]), refs)).toBe('ok');
  });
});

describe('D8 notInMenu', () => {
  it('lists enabled systems with games, collections and smart filters no node names', () => {
    const nodes = [docNode('Nintendo', 'category', [system('snes')])];
    const missing = notInMenu(nodes, refs);
    expect(missing.systems.map((s) => s.id)).toEqual(['n64']);
    expect(missing.collections.map((c) => c.id)).toEqual([1, 2]);
    expect(missing.smartFilters.map((f) => f.id)).toEqual([7]);
  });
});

describe('D8 addReference', () => {
  it('puts a system under the category named after its manufacturer', () => {
    const nodes = [docNode('Sega', 'category'), docNode('Nintendo', 'category', [system('snes')])];
    const { nodes: out, id } = addReference(nodes, null, { type: 'system', refId: 'n64' }, refs);
    const nintendo = out[1];
    expect(nintendo?.children.map((n) => n.refId)).toEqual(['snes', 'n64']);
    expect(findNode(out, id)).toMatchObject({ name: 'Nintendo 64', type: 'system' });
  });

  it('otherwise adds at the end of the selected category, or the root', () => {
    const nodes = [docNode('Lists', 'category'), system('snes')];
    const listsId = nodes[0]?.id ?? '';
    const inLists = addReference(nodes, listsId, { type: 'collection', refId: '1' }, refs);
    expect(inLists.nodes[0]?.children.map((n) => n.name)).toEqual(['Picks']);
    const selectedSystem = nodes[1]?.id ?? '';
    const atRoot = addReference(nodes, selectedSystem, { type: 'smartFilter', refId: '7' }, refs);
    expect(atRoot.nodes.map((n) => n.name)).toEqual(['Lists', 'snes', 'Favorites']);
  });
});
