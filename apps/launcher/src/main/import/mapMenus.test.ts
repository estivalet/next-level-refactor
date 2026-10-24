import type { ImportItem, MenuDocNode } from '@nextlevel/shared';
import { MenuDraftSchema } from '@nextlevel/shared';
import { systemCatalog } from '@nextlevel/system-catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mapCollections } from './mapCollections.ts';
import { mapMenus } from './mapMenus.ts';
import { createSystemMatcher } from './matchSystem.ts';
import { readLegacy, type LegacyFiles } from './readLegacy.ts';
import { legacyCopy, type LegacyCopy } from './testing.ts';

let copy: LegacyCopy;
let files: LegacyFiles;
beforeAll(async () => {
  copy = await legacyCopy();
  files = (await readLegacy(copy.data)).files;
});
afterAll(() => copy.cleanup());

const match = createSystemMatcher(systemCatalog());
let n = 0;
const newId = () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
const has = (items: readonly ImportItem[], key: string, reason: ImportItem['reason']) =>
  items.some((i) => i.key === key && i.reason === reason);

type Shape = [string, string | null, string, string | null, string | null, boolean, Shape[]?];
function shape(nodes: readonly MenuDocNode[]): Shape[] {
  return nodes.map((node) => {
    const row: Shape = [
      node.type,
      node.refId,
      node.name,
      node.displayName,
      node.shortName,
      node.filterTabs,
    ];
    if (node.children.length > 0) row.push(shape(node.children));
    return row;
  });
}

describe('mapCollections', () => {
  it('FR-IMP-1: gamelists that are not systems are collections, in file order', () => {
    const { collections, items } = mapCollections(files, match);
    expect(collections.map((c) => c.name)).toEqual(['Favorites Mix', 'Party Picks']);
    const party = collections.find((c) => c.name === 'Party Picks');
    expect(party?.entries.map((e) => `${e.systemId}/${e.relPath}`)).toEqual([
      'arcade/blastoid.zip',
      'atari-2600/Pixel Quest.a26',
      'atari-2600/Hidden Gem.a26',
      'nintendo-64/Fuzzy Kart.z64',
    ]);
    expect(party?.entries[2]).toMatchObject({ title: 'Hidden Gem' });
    expect(collections[0]?.entries[1]).toMatchObject({
      systemId: 'sony-playstation',
      relPath: 'Orbit Saga (Disc 2).chd',
      discGroup: 'Orbit Saga',
    });
    expect(items.find((i) => i.reason === 'unknownCollectionSystem')).toMatchObject({
      key: 'Party Picks',
      count: 1,
      detail: 'fbneo_libretro',
    });
    expect(has(items, 'Party Picks', 'duplicateEntry')).toBe(true);
    expect(has(items, 'Party Picks', 'collectionLaunchFields')).toBe(true);
  });
});

describe('mapMenus', () => {
  const run = () => mapMenus(files, match, new Set(['party picks', 'favorites mix']), newId);

  it('FR-MENU-2: untyped nodes with children become categories; filter entries become tabs', () => {
    const main = run().menus.find((m) => m.file === 'menu.json');
    expect(main).toMatchObject({ title: 'Main', source: 'nextlevelos:menu.json', active: true });
    expect(shape(main?.nodes ?? [])).toEqual([
      [
        'category',
        null,
        'Consoles',
        null,
        null,
        false,
        [
          ['system', 'atari-2600', 'Atari 2600', null, '2600', true],
          ['system', 'atari-2600', 'Atari 2600', 'Atari VCS', null, false],
          ['system', 'nintendo-64', 'Nintendo 64', null, null, false],
          ['system', 'sony-playstation', 'Sony Playstation', 'PlayStation', null, false],
        ],
      ],
      [
        'category',
        null,
        'Computers',
        null,
        null,
        false,
        [
          ['system', 'microsoft-msx', 'Microsoft MSX', null, null, true],
          ['system', 'amstrad-gx4000', 'Amstrad GX4000', null, 'gx4000', false],
        ],
      ],
      ['system', 'arcade', 'Arcade', 'Games', 'arcade', false],
      ['system', 'flash-games', 'Flash Games', null, null, false],
      [
        'category',
        null,
        'Collections',
        null,
        null,
        false,
        [
          ['collection', 'Party Picks', 'Party Picks', 'Party', null, false],
          ['collection', 'Favorites Mix', 'Favorites Mix', null, null, false],
        ],
      ],
    ]);
  });

  it('FR-IMP-2: what does not map is reported', () => {
    const { items } = run();
    expect(has(items, 'Imaginary Console', 'unknownSystem')).toBe(true);
    expect(has(items, 'Sega Hikaru', 'untypedEntry')).toBe(true);
    expect(has(items, 'Lonely Collection', 'noGamelist')).toBe(true);
    expect(has(items, 'Atari 2600', 'themeOverride')).toBe(true);
    expect(has(items, 'Collections', 'themeOverride')).toBe(true);
    expect(has(items, 'Atari 2600', 'favoriteFilterTab')).toBe(true);
    expect(has(items, 'Microsoft MSX', 'nestedFilterTab')).toBe(true);
  });

  it('FR-MENU-2: a collection node naming a system gamelist is that system', () => {
    const arcade = run().menus.find((m) => m.file === 'menu-arcade.json');
    expect(shape(arcade?.nodes ?? [])).toEqual([
      ['system', 'arcade', 'Arcade', null, null, false],
      ['collection', 'Party Picks', 'Party Picks', null, null, false],
      ['system', 'flash-games', 'Flash Games', 'Flash', null, false],
    ]);
  });

  it('FR-MENU-3: the second menu imports inactive; ids are unique and the tree is valid', () => {
    const { menus } = run();
    const arcade = menus.find((m) => m.file === 'menu-arcade.json');
    expect(arcade).toMatchObject({ title: 'Arcade Cabinet', active: false });
    for (const menu of menus) {
      const nodes = JSON.parse(
        JSON.stringify(menu.nodes)
          .replaceAll('"Party Picks"', '"1"')
          .replaceAll('"Favorites Mix"', '"2"'),
      ) as unknown;
      expect(MenuDraftSchema.safeParse({ title: menu.title, nodes }).success).toBe(true);
    }
  });
});
