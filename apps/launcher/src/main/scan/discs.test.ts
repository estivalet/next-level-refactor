import { describe, expect, it } from 'vitest';
import { titleFromRelPath } from './discs.ts';

describe('titleFromRelPath', () => {
  it('FR-LIB-5: titles drop the extension and disc tag but keep region tags', () => {
    expect(titleFromRelPath('! Brazil/Saga (USA) (Disc 1).chd')).toBe('Saga (USA)');
    expect(titleFromRelPath('Super Demo (Europe) (Rev 1).zip')).toBe('Super Demo (Europe) (Rev 1)');
    expect(titleFromRelPath('Tape Game (Tape 2 Side B).tzx')).toBe('Tape Game');
    expect(titleFromRelPath('noext')).toBe('noext');
  });
});
