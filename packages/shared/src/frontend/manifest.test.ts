import { describe, expect, it } from 'vitest';
import { parseThemeManifest } from './manifest.ts';

describe('parseThemeManifest', () => {
  it('FR-THM-2: a manifest whose id does not match the folder is ignored', () => {
    const result = parseThemeManifest({ id: 'other' }, 'big-box');
    expect(result.manifest).toBeNull();
    expect(result.warnings).toEqual([{ code: 'manifestIdMismatch', field: '"other"' }]);
  });

  it('FR-THM-2: a non-object or a non-boolean fallback is ignored', () => {
    expect(parseThemeManifest('x', 'big-box')).toEqual({
      manifest: null,
      warnings: [{ code: 'manifestNotObject' }],
    });
    expect(parseThemeManifest({ id: 'big-box', fallback: 'no' }, 'big-box')).toEqual({
      manifest: null,
      warnings: [{ code: 'manifestFallbackInvalid' }],
    });
  });

  it('FR-THM-2: art that is not an object is dropped with a warning', () => {
    expect(parseThemeManifest({ id: 'ps5', art: 'x' }, 'ps5').warnings).toEqual([
      { code: 'manifestArtNotObject' },
    ]);
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
    expect(result.warnings).toEqual([
      { code: 'manifestArtWrongType', field: 'backgroundVariants' },
    ]);
  });

  it('FR-THM-2: settings that are not an object are dropped with a warning', () => {
    const result = parseThemeManifest({ id: 'ps5', settings: [1] }, 'ps5');
    expect(result.manifest).toEqual({ id: 'ps5' });
    expect(result.warnings).toEqual([{ code: 'manifestSettingsNotObject' }]);
  });
});
