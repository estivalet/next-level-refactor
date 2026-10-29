import { describe, expect, it } from 'vitest';
import { ItemLocks } from './itemLocks.ts';

describe('per-item locks (D43)', () => {
  it('work on one item runs in order, even after a failure; other items do not wait', async () => {
    const locks = new ItemLocks();
    const order: string[] = [];
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = locks.run('a', async () => {
      await held;
      order.push('a1');
      throw new Error('boom');
    });
    const second = locks.run('a', () => {
      order.push('a2');
      return Promise.resolve();
    });
    await locks.run('b', () => {
      order.push('b1');
      return Promise.resolve();
    });
    release();
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual(['b1', 'a1', 'a2']);
  });
});
