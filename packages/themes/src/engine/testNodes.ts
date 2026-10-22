import type { MenuNode, ThemeGame } from '@nextlevel/shared';

// Small builders for engine tests.

export function category(name: string, children: MenuNode[] = []): MenuNode {
  return { id: `m:${name.toLowerCase()}`, name, display: name, type: 'category', children };
}

export function systemNode(id: string, name: string, children: MenuNode[] = []): MenuNode {
  return { id: `s:${id}`, name, display: name, type: 'system', systemId: id, children };
}

export function filterNode(systemId: string, name: string, filter: string): MenuNode {
  return {
    id: `s:${systemId}:f:${filter}`,
    name,
    display: filter,
    type: 'filter',
    systemId,
    filter,
    children: [],
  };
}

export function collectionNode(id: number, name: string): MenuNode {
  return {
    id: `c:${String(id)}`,
    name,
    display: name,
    type: 'collection',
    collectionId: id,
    children: [],
  };
}

export function game(id: number, overrides: Partial<ThemeGame> = {}): ThemeGame {
  return {
    id,
    systemId: 'snes',
    title: `Game ${String(id)}`,
    year: null,
    genre: null,
    players: null,
    developer: null,
    publisher: null,
    favorite: false,
    hidden: false,
    filters: [],
    playCount: 0,
    lastPlayedAt: null,
    media: [],
    ...overrides,
  };
}
