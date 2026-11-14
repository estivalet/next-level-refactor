import { describe, expect, it } from 'vitest';
import { isLinkHost, normalizeLink } from './linkedFiles.ts';

const DRIVE = 'https://drive.usercontent.google.com/download?id=ABC_123-x&export=download&confirm=t';

describe('linked catalog files (FR-CAT-9, D65)', () => {
  it('FR-CAT-9: Drive share links become the direct download link', () => {
    for (const link of [
      'https://drive.google.com/file/d/ABC_123-x/view?usp=sharing',
      'https://drive.google.com/open?id=ABC_123-x',
      'https://drive.google.com/uc?id=ABC_123-x&export=download',
    ]) {
      expect(normalizeLink(link)).toEqual({ ok: true, host: 'drive', url: DRIVE });
    }
  });

  it('FR-CAT-9: archive.org details and download links with a file path become /download/', () => {
    const url = 'https://archive.org/download/nl-demo/Star%20Hopper.nes';
    expect(normalizeLink('https://archive.org/details/nl-demo/Star%20Hopper.nes')).toEqual({
      ok: true,
      host: 'archive',
      url,
    });
    expect(normalizeLink(url)).toEqual({ ok: true, host: 'archive', url });
  });

  it('FR-CAT-9: other hosts, http and file-less archive.org links are refused', () => {
    expect(normalizeLink('http://drive.google.com/file/d/x/view')).toEqual({
      ok: false,
      reason: 'linkHost',
    });
    expect(normalizeLink('https://example.com/a.nes')).toEqual({ ok: false, reason: 'linkHost' });
    expect(normalizeLink('not a link')).toEqual({ ok: false, reason: 'linkHost' });
    expect(normalizeLink('https://archive.org/details/nl-demo')).toEqual({
      ok: false,
      reason: 'linkFile',
    });
    expect(normalizeLink('https://drive.google.com/drive/folders/x')).toEqual({
      ok: false,
      reason: 'linkFile',
    });
  });

  it('FR-CAT-9: isLinkHost accepts Google and archive.org download hosts only', () => {
    expect(isLinkHost('https://ia800.us.archive.org/1/items/x/a.nes')).toBe(true);
    expect(isLinkHost('https://doc-0s.googleusercontent.com/x')).toBe(true);
    expect(isLinkHost(DRIVE)).toBe(true);
    expect(isLinkHost('https://archive.org.evil.com/x')).toBe(false);
    expect(isLinkHost('http://archive.org/x')).toBe(false);
    expect(isLinkHost('nonsense')).toBe(false);
  });
});
