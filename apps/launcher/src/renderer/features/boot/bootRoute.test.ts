import type { MenuTree } from '@nextlevel/shared';
import { FIXTURE_MENU } from '@nextlevel/themes/testing';
import { describe, expect, it } from 'vitest';
import { bootFrontend, menuHasGames } from './bootRoute.ts';

const EMPTY: MenuTree = {
  title: 'NextLevel',
  items: [
    {
      id: 'm:collections',
      name: 'Collections',
      display: 'Collections',
      type: 'category',
      children: [],
    },
  ],
};

describe('boot routing (FR-THM-5, D1)', () => {
  it('a menu with a system has games; one with only an empty category does not', () => {
    expect(menuHasGames(FIXTURE_MENU)).toBe(true);
    expect(menuHasGames(EMPTY)).toBe(false);
  });

  it('last theme and a chosen theme boot into the front-end', () => {
    expect(bootFrontend({ kind: 'lastTheme' }, true)).toEqual({
      mounted: true,
      visible: true,
      preview: null,
    });
    expect(bootFrontend({ kind: 'theme', themeId: 'big-box' }, true)).toEqual({
      mounted: true,
      visible: true,
      preview: null,
    });
  });

  it('the desktop target, or a library without games, boots to the desktop', () => {
    expect(bootFrontend({ kind: 'desktop' }, true)).toEqual({
      mounted: false,
      visible: false,
      preview: null,
    });
    expect(bootFrontend({ kind: 'lastTheme' }, false)).toEqual({
      mounted: false,
      visible: false,
      preview: null,
    });
  });
});
