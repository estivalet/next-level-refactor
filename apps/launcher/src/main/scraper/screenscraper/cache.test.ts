import { describe, expect, it } from 'vitest';
import { ScraperCache } from './cache.ts';

const DAY = 24 * 3600 * 1000;

describe('ScraperCache', () => {
  it('returns what was put until the kind expires', () => {
    let now = 0;
    const cache = new ScraperCache(':memory:', () => now);
    cache.put('search', '1:orbit', [{ id: '7' }]);
    cache.put('game', '7', { id: '7' });
    now = 6 * DAY;
    expect(cache.get('search', '1:orbit')).toEqual([{ id: '7' }]);
    now = 8 * DAY;
    expect(cache.get('search', '1:orbit')).toBeNull();
    expect(cache.get('game', '7')).toEqual({ id: '7' });
    now = 31 * DAY;
    expect(cache.get('game', '7')).toBeNull();
    cache.close();
  });

  it('kinds do not share keys; a put replaces', () => {
    const cache = new ScraperCache(':memory:', () => 0);
    cache.put('game', '1', 'a');
    cache.put('hash', '1', 'b');
    cache.put('game', '1', 'c');
    expect(cache.get('game', '1')).toBe('c');
    expect(cache.get('hash', '1')).toBe('b');
    expect(cache.get('systems', '1')).toBeNull();
    cache.close();
  });
});
