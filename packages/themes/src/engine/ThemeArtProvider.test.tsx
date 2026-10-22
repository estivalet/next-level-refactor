// Cases ported from NextLevelOS src/themes/engine/useThemeArt.test.tsx @ 3d530b7.
import type { ArtIndex } from '@nextlevel/shared';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FakeThemeHost } from '../host/FakeThemeHost.ts';
import { game } from './testNodes.ts';
import { ThemeArtProvider } from './ThemeArtProvider.tsx';
import type { ThemeArtConfig } from './types.ts';
import { useThemeArt, type ThemeArtApi } from './useThemeArt.ts';
import { useThemeSettings } from './useThemeSettings.ts';

const moduleArt: ThemeArtConfig = {
  logoVariant: 'clear',
  backgroundVariants: ['background/artwork'],
  useVideoBackground: true,
};

const index = (overrides: Partial<ArtIndex> = {}): ArtIndex => ({
  packFiles: ['logo/clear/SNES.png'],
  assetsFiles: ['logo/clear/SNES.png', 'logo/steel/SNES.png', 'sound/move-menu.ogg'],
  manifest: null,
  warnings: [],
  ...overrides,
});

function setup(host: FakeThemeHost, moduleSettings: Record<string, unknown> = {}) {
  const seen: { art: ThemeArtApi | null; settings: Record<string, unknown> } = {
    art: null,
    settings: {},
  };
  function Probe() {
    seen.art = useThemeArt();
    seen.settings = useThemeSettings();
    return null;
  }
  render(
    <ThemeArtProvider
      host={host}
      themeId="big-box"
      moduleArt={moduleArt}
      moduleSettings={moduleSettings}
    >
      <Probe />
    </ThemeArtProvider>,
  );
  const art = () => {
    if (!seen.art) throw new Error('not rendered');
    return seen.art;
  };
  return {
    art,
    seen,
    ready: () =>
      waitFor(() => {
        expect(art().ready).toBe(true);
      }),
  };
}

describe('ThemeArtProvider (FR-THM-2, FR-THM-4)', () => {
  it('serves pack art before shared art, as nextlevel URLs', async () => {
    const ctx = setup(new FakeThemeHost({ art: index() }));
    await ctx.ready();
    expect(ctx.art().logo('SNES')).toEqual([
      'nextlevel://art/pack/big-box/logo/clear/SNES.png',
      'nextlevel://art/assets/logo/clear/SNES.png',
    ]);
    expect(ctx.art().sound('move-menu')).toEqual(['nextlevel://art/assets/sound/move-menu.ogg']);
  });

  it('a pack with fallback off never uses the shared folder', async () => {
    const ctx = setup(
      new FakeThemeHost({ art: index({ manifest: { id: 'big-box', fallback: false } }) }),
    );
    await ctx.ready();
    expect(ctx.art().logo('SNES')).toEqual(['nextlevel://art/pack/big-box/logo/clear/SNES.png']);
    expect(ctx.art().fallback).toBe(false);
  });

  it('user options beat the pack, which beats the module', async () => {
    const host = new FakeThemeHost({
      art: index({
        manifest: {
          id: 'big-box',
          art: { logoVariant: 'steel', useVideoBackground: false },
          settings: { wheel: { itemHeight: 90, spacing: 1 } },
        },
      }),
      options: {
        'big-box': { art: { useVideoBackground: true }, settings: { wheel: { spacing: 0.5 } } },
      },
    });
    const ctx = setup(host, { wheel: { itemHeight: 80, focusScale: 1.2 } });
    await ctx.ready();
    expect(ctx.art().config).toMatchObject({ logoVariant: 'steel', useVideoBackground: true });
    expect(ctx.seen.settings).toEqual({ wheel: { itemHeight: 90, spacing: 0.5, focusScale: 1.2 } });
  });

  it('a settings change re-reads the user options', async () => {
    const options: Record<string, { art: { logoVariant: string } }> = {
      'big-box': { art: { logoVariant: 'clear' } },
    };
    const host = new FakeThemeHost({ art: index(), options });
    const ctx = setup(host);
    await ctx.ready();
    // A new snapshot brings new objects, as the launcher host's settings do.
    options['big-box'] = { art: { logoVariant: 'steel' } };
    act(() => {
      host.emit({ type: 'settings-changed' });
    });
    expect(ctx.art().config.logoVariant).toBe('steel');
    expect(ctx.art().logo('SNES')).toEqual(['nextlevel://art/assets/logo/steel/SNES.png']);
  });

  it('game media comes only from indexed kinds; tile art follows gameArt per system', async () => {
    const host = new FakeThemeHost({
      art: index(),
      options: { 'big-box': { art: { gameArt: { n64: ['marquee', 'box-front'] } } } },
    });
    const ctx = setup(host);
    await ctx.ready();
    const snes = game(4, { media: ['box-front', 'screenshot-title'] });
    const n64 = game(5, { systemId: 'n64', media: ['box-front', 'marquee'] });
    expect(ctx.art().gameMedia(snes, 'fanart')).toBeNull();
    expect(ctx.art().gameTile(snes)).toEqual([
      'nextlevel://media/4/box-front',
      'nextlevel://media/4/screenshot-title',
    ]);
    expect(ctx.art().gameTile(n64)).toEqual([
      'nextlevel://media/5/marquee',
      'nextlevel://media/5/box-front',
    ]);
  });

  it('an art index that fails to load leaves text fallbacks, not a crash', async () => {
    const host = new FakeThemeHost();
    vi.spyOn(host, 'loadArtIndex').mockRejectedValue(new Error('offline drive'));
    const ctx = setup(host);
    await ctx.ready();
    expect(ctx.art().logo('SNES')).toEqual([]);
  });
});
