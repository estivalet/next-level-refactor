import { describe, expect, it } from 'vitest';
import {
  ArtIndexSchema,
  MenuNodeSchema,
  MenuTreeSchema,
  ThemeGameSchema,
  ThemeOptionsSchema,
} from './schema.ts';

const game = {
  id: 1,
  systemId: 'snes',
  title: 'Super Metroid',
  year: 1994,
  genre: null,
  players: null,
  developer: null,
  publisher: null,
  favorite: false,
  hidden: false,
  filters: ['official'],
  playCount: 0,
  lastPlayedAt: null,
  media: ['box-front'],
};

describe('front-end contracts', () => {
  it('FR-THM-6: a nested menu tree parses', () => {
    const tree = {
      title: 'NextLevel',
      items: [
        {
          id: 'm:nintendo',
          name: 'Nintendo',
          display: 'Nintendo',
          type: 'category',
          children: [
            {
              id: 's:snes',
              name: 'Super Nintendo',
              display: 'Super Nintendo',
              type: 'system',
              systemId: 'snes',
              children: [
                {
                  id: 's:snes:f:homebrew',
                  name: 'Super Nintendo',
                  display: 'Homebrew',
                  type: 'filter',
                  systemId: 'snes',
                  filter: 'homebrew',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };
    const parsed = MenuTreeSchema.parse(tree);
    expect(parsed.items[0]?.children[0]?.children[0]?.filter).toBe('homebrew');
  });

  it('FR-LIB-9: a smart filter is a menu node type with its id', () => {
    const node = {
      id: 'sf:3',
      name: 'Favorites',
      display: 'Favorites',
      type: 'smartFilter',
      smartFilterId: 3,
      children: [],
    };
    expect(MenuNodeSchema.safeParse(node).success).toBe(true);
    expect(MenuNodeSchema.safeParse({ ...node, smartFilterId: 0 }).success).toBe(false);
  });

  it('FR-THM-6: theme game media kinds are lowercase slugs', () => {
    expect(ThemeGameSchema.safeParse(game).success).toBe(true);
    expect(ThemeGameSchema.safeParse({ ...game, media: ['Box-Front'] }).success).toBe(false);
  });

  it('FR-THM-4: theme options accept the art block and free settings', () => {
    const options = ThemeOptionsSchema.parse({
      art: { logoVariant: 'clear', gameBackgroundSources: ['fanart', 'video'] },
      settings: { filtersInMenu: true },
    });
    expect(options.art?.gameBackgroundSources).toEqual(['fanart', 'video']);
    expect(
      ThemeOptionsSchema.safeParse({ art: { gameBackgroundSources: ['poster'] } }).success,
    ).toBe(false);
  });

  it('FR-THM-2: an art index lists both roots', () => {
    const index = ArtIndexSchema.parse({
      packFiles: ['logo/clear/Sega Saturn.png'],
      assetsFiles: [],
      manifest: null,
      warnings: [],
    });
    expect(index.packFiles).toHaveLength(1);
  });
});
