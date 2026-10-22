import { describe, expect, it } from 'vitest';
import { artUrl, mediaUrl, parseNextlevelUrl } from './urls.ts';

describe('nextlevel URLs', () => {
  it('FR-THM-6: an art URL round-trips with spaces and accents', () => {
    const url = artUrl({ kind: 'pack', themeId: 'big-box' }, 'logo/clear/Sega Saturn é.png');
    expect(url).toBe('nextlevel://art/pack/big-box/logo/clear/Sega%20Saturn%20%C3%A9.png');
    expect(parseNextlevelUrl(url)).toEqual({
      kind: 'art',
      root: { kind: 'pack', themeId: 'big-box' },
      rel: 'logo/clear/Sega Saturn é.png',
    });
    expect(parseNextlevelUrl(artUrl({ kind: 'assets' }, 'video/Arcade.mp4'))).toEqual({
      kind: 'art',
      root: { kind: 'assets' },
      rel: 'video/Arcade.mp4',
    });
  });

  it('FR-THM-6: a media URL round-trips', () => {
    expect(mediaUrl(42, 'box-front')).toBe('nextlevel://media/42/box-front');
    expect(parseNextlevelUrl('nextlevel://media/42/box-front')).toEqual({
      kind: 'media',
      gameId: 42,
      mediaKind: 'box-front',
    });
  });

  it('FR-THM-6: paths that could leave the root are rejected', () => {
    for (const bad of [
      'nextlevel://art/assets/..%2Fx',
      'nextlevel://art/assets/../x',
      'nextlevel://art/assets/a%5Cb',
      'nextlevel://art/assets/C%3A/x',
      'nextlevel://art/assets/a//b',
      'nextlevel://art/assets/',
      'nextlevel://art/pack/../x.png',
      'nextlevel://art/pack/Big_Box/x.png',
      'nextlevel://art/other/x.png',
      'nextlevel://media/0/box-front',
      'nextlevel://media/1/Box-Front',
      'nextlevel://media/1/box-front/x',
      'https://art/assets/x.png',
      'not a url',
    ]) {
      expect(parseNextlevelUrl(bad), bad).toBeNull();
    }
  });
});
