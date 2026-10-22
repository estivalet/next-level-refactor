// Cases ported from NextLevelOS src/themes/engine/filteredFocus.test.ts @ 3d530b7.
import { describe, expect, it } from 'vitest';
import { displayIndexOf, engineIndexOf } from './filteredFocus.ts';

const a = { id: 'a' },
  b = { id: 'b' },
  c = { id: 'c' };
const all = [a, b, c];
const display = [a, c];

describe('filteredFocus (FR-THM-1)', () => {
  it('maps engine → display', () => {
    expect(displayIndexOf(all, display, 2)).toBe(1);
    expect(displayIndexOf(all, display, 1)).toBe(-1);
    expect(displayIndexOf(all, display, 9)).toBe(-1);
  });
  it('maps display → engine', () => {
    expect(engineIndexOf(all, display, 1)).toBe(2);
    expect(engineIndexOf(all, display, 5)).toBe(-1);
  });
});
