// Cases ported from NextLevelOS src/themes/big-box-list/systemNode.test.ts @ 3d530b7, on MenuNodes.
import type { MenuNode } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import type { Level } from '../engine/types.ts';
import { gamesHeader, systemNodeFor } from './systemNode.ts';

const node = (over: Partial<MenuNode> & Pick<MenuNode, 'id' | 'name' | 'type'>): MenuNode => ({
  display: over.name,
  children: [],
  ...over,
});

const root: Level = { kind: 'menu', node: null, items: [], title: 'NextLevel', lastFocusIndex: 0 };
const nintendo = node({ id: 'm:nintendo', name: 'Nintendo', type: 'category' });
const menu = (n: MenuNode): Level => ({
  kind: 'menu',
  node: n,
  items: n.children,
  title: n.display,
  lastFocusIndex: 0,
});
const games = (n: MenuNode): Level => ({
  kind: 'games',
  node: n,
  systemId: n.systemId ?? null,
  systemName: n.name,
  games: [],
  loading: false,
  lastFocusIndex: 0,
});

describe('systemNodeFor (FR-THM-1)', () => {
  it('a system games level is its own system', () => {
    const n64 = node({ id: 's:n64', name: 'Nintendo 64', type: 'system', systemId: 'n64' });
    expect(systemNodeFor([root, menu(nintendo), games(n64)])).toBe(n64);
  });

  it('a filter leaf uses the system above it', () => {
    const official = node({
      id: 's:snes:f:official',
      name: 'Super Nintendo',
      display: 'Official',
      type: 'filter',
      systemId: 'snes',
      filter: 'official',
    });
    const snes = node({
      id: 's:snes',
      name: 'Super Nintendo',
      type: 'system',
      systemId: 'snes',
      children: [official],
    });
    expect(systemNodeFor([root, menu(nintendo), menu(snes), games(official)])).toBe(snes);
  });

  it('a collection with no system above it is its own node', () => {
    const party = node({ id: 'c:1', name: 'Party picks', type: 'collection', collectionId: 1 });
    expect(systemNodeFor([root, menu(nintendo), games(party)])).toBe(party);
  });

  it('an empty stack has no node', () => {
    expect(systemNodeFor([])).toBeNull();
  });
});

describe('gamesHeader', () => {
  it('uses the display name and uppercases the short name as the badge', () => {
    const n64 = node({
      id: 's:n64',
      name: 'Nintendo 64',
      display: 'N64 Console',
      type: 'system',
      shortName: 'n64',
    });
    expect(gamesHeader(n64, (n) => n.display)).toEqual({ title: 'N64 Console', badge: 'N64' });
  });

  it('no short name means no badge', () => {
    const genesis = node({ id: 's:genesis', name: 'Sega Genesis', type: 'system' });
    expect(gamesHeader(genesis, (n) => n.display)).toEqual({ title: 'Sega Genesis', badge: null });
  });

  it('no node, no header', () => {
    expect(gamesHeader(null, (n) => n.display)).toEqual({ title: '', badge: null });
  });
});
