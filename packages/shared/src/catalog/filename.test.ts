import { describe, expect, it } from 'vitest';
import { CATALOG_SLUG, safeFilename } from './filename.ts';

describe('safeFilename (Global Constraints, Review Focus 2)', () => {
  it.each([
    ['..'],
    ['.'],
    ['a/b.nes'],
    ['a\\b.nes'],
    ['C:x.nes'],
    ['CON.nes'],
    ['nul'],
    ['com1.nes'],
    ['LPT9'],
    ['COM0.nes'],
    ['lpt0'],
    ['COM¹.nes'],
    ['LPT³'],
    ['CONIN$'],
    ['conout$.txt'],
    ['CON .nes'],
    ['nul .txt'],
    ['aux   .md'],
    ['x.'],
    ['x '],
    ['\u0000x.nes'],
    ['tab\there.nes'],
    ['what?.nes'],
    ['star*.nes'],
    ['"q".nes'],
    ['<a>.nes'],
    ['a|b.nes'],
    [''],
    ['a'.repeat(197) + '.nes'],
  ])('refuses %j', (name) => {
    expect(safeFilename(name)).toBe(false);
  });

  it('accepts an ordinary name, up to 200 characters', () => {
    expect(safeFilename('Star Hopper (v1.1).nes')).toBe(true);
    expect(safeFilename('a'.repeat(196) + '.nes')).toBe(true);
    expect(safeFilename('readme.txt')).toBe(true);
  });

  it('checks the extension against the system list, ignoring case', () => {
    expect(safeFilename('game.exe', ['nes'])).toBe(false);
    expect(safeFilename('game', ['nes'])).toBe(false);
    expect(safeFilename('Game.NES', ['nes', 'zip'])).toBe(true);
  });
});

describe('catalog slug', () => {
  it.each([['star-hopper'], ['a1'], ['x']])('accepts %s', (slug) => {
    expect(CATALOG_SLUG.test(slug)).toBe(true);
  });

  it.each([['Star'], ['-a'], ['a-'], ['a--b'], ['a_b'], ['']])('refuses %j', (slug) => {
    expect(CATALOG_SLUG.test(slug)).toBe(false);
  });
});
