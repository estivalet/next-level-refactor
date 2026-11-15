// The PS5 Style home after the hero redesign (FR-THM-1): the selected system named beside its tile,
// "Manufacturer · Year" under the hero logo, and Games/Favorites stats at the bottom right.
import type { MenuNode, MenuTree, ThemeSystemInfo } from '@nextlevel/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { FIXTURE_GAMES } from '../host/fixtures.ts';
import { NO_ART_FILES, press, renderTheme } from '../themeTestUtils.tsx';
import { ps5Theme } from './index.ts';

const systemNode = (id: string, name: string, shortName?: string): MenuNode => ({
  id: `s:${id}`,
  name,
  display: name,
  type: 'system',
  systemId: id,
  ...(shortName ? { shortName } : {}),
  children: [],
});
const category = (name: string, children: MenuNode[]): MenuNode => ({
  id: `m:${name}`,
  name,
  display: name,
  type: 'category',
  children,
});

/** An entry with neither maker nor year. */
const N64_BARE: ThemeSystemInfo = {
  systemId: 'n64',
  fullName: 'Nintendo 64 Home Console',
  models: [],
  peripherals: [],
  topGames: [],
  sources: [],
};
const N64_INFO: ThemeSystemInfo = { ...N64_BARE, manufacturer: 'Nintendo', releaseYear: 1996 };

const MENU: MenuTree = {
  title: 'NextLevel',
  items: [category('Home', [systemNode('n64', 'Nintendo 64', 'n64')])],
};

const q = (selector: string) => document.querySelector(selector);
const text = (selector: string) => q(selector)?.textContent ?? null;

async function ready(host: FakeThemeHost, first = 'Home') {
  renderTheme(ps5Theme, { host });
  await waitFor(() => {
    expect(
      screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')
        ?.textContent,
    ).toBe(first);
  });
}

describe('PS5 home hero (FR-THM-1)', () => {
  it('FR-THM-1: the selected tile shows its short-name badge and full name beside it', async () => {
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu: MENU }));
    const title = q('[data-focused="true"] .ps5-title');
    expect(title).not.toBeNull();
    expect(text('.ps5-title-badge')).toBe('N64');
    expect(text('.ps5-title-name')).toBe('Nintendo 64');
    expect(q('.ps5-icon-label')).toBeNull();
    expect(document.querySelectorAll('.ps5-title')).toHaveLength(1);
  });

  it('FR-THM-1: no short name shows the name only', async () => {
    await ready(new FakeThemeHost({ art: NO_ART_FILES }), 'Nintendo');
    press('ArrowRight'); // Nintendo 64 in the fixture has no short name
    expect(text('.ps5-title-name')).toBe('Nintendo 64');
    expect(q('.ps5-title-badge')).toBeNull();
  });

  it('FR-THM-1: the full name prefers the museum fullName, the label until it loads', async () => {
    await ready(
      new FakeThemeHost({ art: NO_ART_FILES, menu: MENU, systemInfo: { n64: N64_INFO } }),
    );
    expect(text('.ps5-title-name')).toBe('Nintendo 64');
    await waitFor(() => {
      expect(text('.ps5-title-name')).toBe('Nintendo 64 Home Console');
    });
  });

  it('FR-THM-1: the hero shows manufacturer · year', async () => {
    await ready(
      new FakeThemeHost({ art: NO_ART_FILES, menu: MENU, systemInfo: { n64: N64_INFO } }),
    );
    await waitFor(() => {
      expect(text('.ps5-hero-meta')).toBe('Nintendo · 1996');
    });
    expect(q('.ps5-hero-count')).toBeNull();
  });

  it('FR-THM-1: the hero meta leaves out a missing part', async () => {
    const noYear: ThemeSystemInfo = { ...N64_BARE, manufacturer: 'Nintendo' };
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu: MENU, systemInfo: { n64: noYear } }));
    await waitFor(() => {
      expect(text('.ps5-hero-meta')).toBe('Nintendo');
    });
  });

  it('FR-THM-1: the hero meta is omitted when the entry has no maker or year', async () => {
    await ready(
      new FakeThemeHost({ art: NO_ART_FILES, menu: MENU, systemInfo: { n64: N64_BARE } }),
    );
    await waitFor(() => {
      expect(text('.ps5-title-name')).toBe('Nintendo 64 Home Console');
    });
    expect(q('.ps5-hero-meta')).toBeNull();
  });

  it('FR-THM-1: stats show games and favorites, None at zero', async () => {
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu: MENU }));
    await waitFor(() => {
      expect(text('.ps5-stat--games .ps5-stat-value')).toBe('8');
    });
    expect(text('.ps5-stat--games .ps5-stat-label')).toBe('Games');
    expect(q('.ps5-stat--games svg')).not.toBeNull();
    expect(text('.ps5-stat--favorites .ps5-stat-label')).toBe('Favorites');
    expect(text('.ps5-stat--favorites .ps5-stat-value')).toBe('None');
  });

  it('FR-THM-1: stats count visible favorites and show … while loading', async () => {
    const games = FIXTURE_GAMES.map((game) =>
      game.systemId === 'n64' && game.id % 3 === 0 ? { ...game, favorite: true } : game,
    );
    const expected = games.filter((g) => g.systemId === 'n64' && g.favorite).length;
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu: MENU, games }));
    expect(text('.ps5-stat--games .ps5-stat-value')).toBe('…');
    await waitFor(() => {
      expect(text('.ps5-stat--favorites .ps5-stat-value')).toBe(String(expected));
    });
  });

  it('FR-THM-1: stats are hidden when the games cannot be listed', async () => {
    const menu: MenuTree = {
      title: 'NextLevel',
      items: [category('Home', [{ ...systemNode('x', 'Broken'), id: 'z:broken' }])],
    };
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu }));
    expect(q('.ps5-stats')).not.toBeNull();
    await waitFor(() => {
      expect(q('.ps5-stats')).toBeNull();
    });
  });

  it('FR-THM-1: a category shows Items and no favorites or manufacturer', async () => {
    const menu: MenuTree = {
      title: 'NextLevel',
      items: [
        category('Home', [
          category('Inner', [systemNode('n64', 'Nintendo 64'), systemNode('snes', 'SNES')]),
        ]),
      ],
    };
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu, systemInfo: { n64: N64_INFO } }));
    expect(text('.ps5-stat--items .ps5-stat-label')).toBe('Items');
    expect(text('.ps5-stat--items .ps5-stat-value')).toBe('2');
    expect(q('.ps5-stat--games')).toBeNull();
    expect(q('.ps5-stat--favorites')).toBeNull();
    expect(q('.ps5-hero-meta')).toBeNull();
    expect(text('.ps5-title-name')).toBe('Inner');
  });
  it('FR-THM-1: a system with no games shows Games 0 and Favorites None', async () => {
    const menu: MenuTree = {
      title: 'NextLevel',
      items: [category('Home', [systemNode('empty', 'Empty')])],
    };
    await ready(new FakeThemeHost({ art: NO_ART_FILES, menu }));
    await waitFor(() => {
      expect(text('.ps5-stat--games .ps5-stat-value')).toBe('0');
    });
    expect(text('.ps5-stat--favorites .ps5-stat-value')).toBe('None');
  });

  it('FR-THM-1: filter tiles inside a system keep their own names, without maker or year', async () => {
    const snes: ThemeSystemInfo = {
      ...N64_INFO,
      systemId: 'snes',
      fullName: 'Super Nintendo Entertainment System',
    };
    await ready(new FakeThemeHost({ art: NO_ART_FILES, systemInfo: { snes } }), 'Nintendo');
    await waitFor(() => {
      expect(text('.ps5-title-name')).toBe('Super Nintendo Entertainment System');
    });
    press('Enter'); // Super Nintendo's filters
    await waitFor(() => {
      expect(text('.ps5-title-name')).toBe('Official');
    });
    // Past the museum lookup's settle delay: a filter still never takes the system's name.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(text('.ps5-title-name')).toBe('Official');
    expect(q('.ps5-hero-meta')).toBeNull();
  });

  it('FR-THM-1: a system with filter children shows Games and Favorites, not Items', async () => {
    await ready(new FakeThemeHost({ art: NO_ART_FILES }), 'Nintendo'); // Super Nintendo: 2 filters
    await waitFor(() => {
      expect(text('.ps5-stat--games .ps5-stat-value')).toBe('10');
    });
    expect(text('.ps5-stat--favorites .ps5-stat-value')).toBe('None');
    expect(q('.ps5-stat--items')).toBeNull();
  });

  describe('title placement', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('FR-THM-1: near the right edge the title flips beside the tile instead of clipping', async () => {
      // A 1280 px shelf fits 9 slots, so 9 items do not loop and the last one sits at the edge.
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.hasAttribute('data-window-start') ? 1280 : 0;
      });
      const nine = Array.from({ length: 9 }, (_, i) =>
        systemNode(`s${String(i)}`, `System ${String(i)}`),
      );
      await ready(
        new FakeThemeHost({
          art: NO_ART_FILES,
          menu: { title: 'NextLevel', items: [category('Home', nine)] },
        }),
      );
      const title = () => q('.ps5-title') as HTMLElement;
      await waitFor(() => {
        expect(title().style.maxWidth).toBe('640px');
      });
      expect(title().classList.contains('ps5-title--left')).toBe(false);
      for (let i = 0; i < 8; i++) press('ArrowRight');
      expect(text('.ps5-title-name')).toBe('System 8');
      await waitFor(() => {
        expect(title().classList.contains('ps5-title--left')).toBe(true);
      });
      expect(title().style.maxWidth).toBe('640px');
    });
  });
});
