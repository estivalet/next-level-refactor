import { describe, expect, it } from 'vitest';
import { selectMedia, targetExtension } from './mediaSelect.ts';
import type { SsGame } from './types.ts';

const media = (
  type: string,
  region: string | undefined,
  url = `https://x/${type}-${region ?? 'any'}`,
) => ({
  type,
  ...(region === undefined ? {} : { region }),
  url,
  format: 'png',
});

describe('selectMedia (FR-SCR-1, D16)', () => {
  it('maps ScreenScraper types to art kinds, one item per kind by region priority', () => {
    const game: SsGame = {
      id: '1',
      medias: [
        media('box-2D', 'jp'),
        media('box-2D', 'us'),
        media('box-2D-back', 'eu'),
        media('box-3D', 'wor'),
        media('support-2D', 'us'),
        media('fanart', undefined),
        media('video', undefined),
        media('ss', 'wor'),
        media('sstitle', 'jp'),
        media('wheel', 'eu'),
        media('screenmarquee', 'wor'),
        media('mixrbv1', 'wor'),
      ],
    };
    const selected = selectMedia(game, ['us', 'eu', 'wor', 'jp']);
    expect(Object.keys(selected).sort()).toEqual([
      'box-3d',
      'box-back',
      'box-front',
      'cart-front',
      'fanart',
      'logo-clear',
      'marquee',
      'screenshot-game-play',
      'screenshot-game-title',
      'video',
    ]);
    expect(selected['box-front']?.url).toBe('https://x/box-2D-us');
  });

  it('a region suffix in the type still maps (wheel-us, wheel_eu, wheel(jp))', () => {
    for (const type of ['wheel-us', 'wheel_eu', 'wheel(jp)']) {
      expect(selectMedia({ id: '1', medias: [media(type, undefined)] }, ['us'])).toHaveProperty(
        'logo-clear',
      );
    }
  });

  it('an unlisted region ranks after the listed ones; ties keep the API order', () => {
    const game: SsGame = {
      id: '1',
      medias: [media('wheel', 'kr', 'a'), media('wheel', 'jp', 'b'), media('wheel', 'jp', 'c')],
    };
    expect(selectMedia(game, ['us', 'jp'])['logo-clear']?.url).toBe('b');
  });

  it('ignores items without a url and games without medias', () => {
    expect(selectMedia({ id: '1', medias: [{ type: 'wheel' }] }, ['us'])).toEqual({});
    expect(selectMedia({ id: '1', medias: 'x' }, ['us'])).toEqual({});
  });
});

describe('targetExtension (D17)', () => {
  it.each([
    ['box-front', 'jpg', '.png'],
    ['box-front', 'png', '.png'],
    ['fanart', 'jpg', '.jpg'],
    ['fanart', 'JPEG', '.jpg'],
    ['fanart', 'png', '.png'],
    ['video', 'mp4', '.mp4'],
    ['logo-clear', 'webp', '.png'],
  ] as const)('%s from %s → %s', (kind, format, ext) => {
    expect(targetExtension(kind, format)).toBe(ext);
  });
});
