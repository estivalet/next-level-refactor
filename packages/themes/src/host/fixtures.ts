import type { ArtIndex, MenuNode, MenuTree, ThemeGame } from '@nextlevel/shared';

// A small library for engine and theme tests: two manufacturers, four systems (the SNES one has
// filters), one collection and 30 games.

const system = (id: string, name: string, children: MenuNode[] = []): MenuNode => ({
  id: `s:${id}`,
  name,
  display: name,
  type: 'system',
  systemId: id,
  children,
});

const filter = (systemId: string, name: string, slug: string, display: string): MenuNode => ({
  id: `s:${systemId}:f:${slug}`,
  name,
  display,
  type: 'filter',
  systemId,
  filter: slug,
  children: [],
});

export const FIXTURE_MENU: MenuTree = {
  title: 'NextLevel',
  items: [
    {
      id: 'm:nintendo',
      name: 'Nintendo',
      display: 'Nintendo',
      type: 'category',
      children: [
        system('snes', 'Super Nintendo', [
          filter('snes', 'Super Nintendo', 'official', 'Official'),
          filter('snes', 'Super Nintendo', 'homebrew', 'Homebrew'),
        ]),
        system('n64', 'Nintendo 64'),
      ],
    },
    {
      id: 'm:sega',
      name: 'Sega',
      display: 'Sega',
      type: 'category',
      children: [system('genesis', 'Sega Genesis'), system('saturn', 'Sega Saturn')],
    },
    {
      id: 'm:collections',
      name: 'Collections',
      display: 'Collections',
      labelKey: 'frontend.menu.collections',
      type: 'category',
      children: [
        {
          id: 'c:1',
          name: 'Party picks',
          display: 'Party picks',
          type: 'collection',
          collectionId: 1,
          children: [],
        },
      ],
    },
  ],
};

let nextId = 1;
function games(systemId: string, titles: string[], filters: string[] = ['official']): ThemeGame[] {
  return titles.map((title, index) => ({
    id: nextId++,
    systemId,
    title,
    year: 1990 + index,
    genre: null,
    players: null,
    developer: null,
    publisher: null,
    favorite: false,
    hidden: false,
    filters,
    playCount: 0,
    lastPlayedAt: null,
    media: ['box-front'],
  }));
}

const letters = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix} ${String.fromCharCode(65 + i)}`);

export const FIXTURE_GAMES: readonly ThemeGame[] = [
  ...games('snes', letters('Snes', 8)),
  ...games('snes', letters('Homebrew', 2), ['homebrew']),
  ...games('n64', letters('N64', 8)),
  ...games('genesis', letters('Genesis', 8)),
  ...games('saturn', letters('Saturn', 4)),
];

/** Collection 1, in its own order. */
export const FIXTURE_COLLECTION: readonly number[] = [20, 3, 11];

export const FIXTURE_ART: ArtIndex = {
  packFiles: ['logo/clear/Nintendo.png'],
  assetsFiles: [
    'logo/clear/Nintendo.png',
    'logo/clear/Super Nintendo.png',
    'background/artwork/Sega.jpg',
    'video/Sega Genesis.mp4',
  ],
  manifest: null,
  warnings: [],
};
