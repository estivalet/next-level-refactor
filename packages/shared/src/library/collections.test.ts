import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { CollectionNameSchema } from './collections.ts';

describe('collection contracts', () => {
  it('FR-LIB-8: collection names are trimmed and 1..100 chars', () => {
    expect(CollectionNameSchema.parse('  Picks ')).toBe('Picks');
    expect(CollectionNameSchema.safeParse('   ').success).toBe(false);
    expect(CollectionNameSchema.safeParse('x'.repeat(101)).success).toBe(false);
    const update = ipcContract['collections.update'].input;
    expect(update.safeParse({ id: 1, sort: 'year' }).success).toBe(true);
    expect(update.safeParse({ id: 1, sort: 'rating' }).success).toBe(false);
    const reorder = ipcContract['collections.reorder'].input;
    expect(reorder.safeParse({ id: 1, gameId: 2, swapWithGameId: 3 }).success).toBe(true);
    expect(reorder.safeParse({ id: 1, gameId: 2, position: 0 }).success).toBe(false);
  });
});
