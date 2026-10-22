import { describe, expect, it } from 'vitest';
import { parseThemeManifest } from './manifest.ts';

describe('parseThemeManifest', () => {
  it('FR-THM-2: a manifest whose id does not match the folder is ignored', () => {
    const result = parseThemeManifest({ id: 'other' }, 'big-box');
    expect(result.manifest).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it('FR-THM-2: a non-object or a non-boolean fallback is ignored', () => {
    expect(parseThemeManifest('x', 'big-box').manifest).toBeNull();
    expect(parseThemeManifest({ id: 'big-box', fallback: 'no' }, 'big-box').manifest).toBeNull();
  });

  it('FR-THM-2: a wrong-typed art key is dropped and the others are kept', () => {
    const result = parseThemeManifest(
      {
        id: 'big-box',
        version: '1.0',
        fallback: false,
        art: { backgroundVariants: 'x', logoVariant: 'steel', gameArt: { default: ['box-front'] } },
        settings: { filtersInMenu: false },
      },
      'big-box',
    );
    expect(result.manifest).toEqual({
      id: 'big-box',
      version: '1.0',
      fallback: false,
      art: { logoVariant: 'steel', gameArt: { default: ['box-front'] } },
      settings: { filtersInMenu: false },
    });
    expect(result.warnings).toEqual(['art.backgroundVariants has the wrong type; ignored']);
  });

  it('FR-THM-2: settings that are not an object are dropped with a warning', () => {
    const result = parseThemeManifest({ id: 'ps5', settings: [1] }, 'ps5');
    expect(result.manifest).toEqual({ id: 'ps5' });
    expect(result.warnings).toHaveLength(1);
  });
});
