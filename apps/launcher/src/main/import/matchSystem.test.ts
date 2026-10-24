import { systemCatalog } from '@nextlevel/system-catalog';
import { describe, expect, it } from 'vitest';
import { createSystemMatcher, matchSystem } from './matchSystem.ts';

describe('matchSystem', () => {
  it('FR-IMP-1: a NextLevelOS system name maps to its catalog id', () => {
    expect(matchSystem('Atari 2600', systemCatalog())).toBe('atari-2600');
    expect(matchSystem('Amstrad GX4000', systemCatalog())).toBe('amstrad-gx4000');
  });

  it('FR-IMP-1: case, spaces and punctuation are ignored', () => {
    expect(matchSystem('Sony PlayStation', systemCatalog())).toBe('sony-playstation');
    expect(matchSystem(' atari-2600 ', systemCatalog())).toBe('atari-2600');
  });

  it('FR-IMP-1: names the catalog does not know give null', () => {
    expect(matchSystem('fbneo_libretro', systemCatalog())).toBeNull();
    expect(matchSystem('', systemCatalog())).toBeNull();
  });

  it('FR-IMP-1: a matcher built once answers repeated names', () => {
    const match = createSystemMatcher(systemCatalog());
    expect(match('Nintendo 64')).toBe('nintendo-64');
    expect(match('Imaginary Console')).toBeNull();
  });
});
