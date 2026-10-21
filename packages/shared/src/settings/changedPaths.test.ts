import { describe, expect, it } from 'vitest';
import { changedPaths } from './changedPaths.ts';

describe('changedPaths', () => {
  it('US-D3: lists the dotted leaf paths that differ', () => {
    expect(changedPaths({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 }, d: true })).toEqual([
      'a.c',
      'd',
    ]);
  });

  it('returns nothing for equal values', () => {
    expect(changedPaths({ a: [1, 2], b: { c: null } }, { a: [1, 2], b: { c: null } })).toEqual([]);
  });

  it('compares arrays as whole values', () => {
    expect(changedPaths({ a: [1, 2] }, { a: [2, 1] })).toEqual(['a']);
  });
});
