import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { ScraperCache } from './cache.ts';

const DAY = 24 * 3600 * 1000;

describe('ScraperCache', () => {
  it('returns what was put until the kind expires', () => {
    let now = 0;
    const cache = new ScraperCache(':memory:', () => now, { warn: vi.fn() });
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
    const cache = new ScraperCache(':memory:', () => 0, { warn: vi.fn() });
    cache.put('game', '1', 'a');
    cache.put('hash', '1', 'b');
    cache.put('game', '1', 'c');
    expect(cache.get('game', '1')).toBe('c');
    expect(cache.get('hash', '1')).toBe('b');
    expect(cache.get('systems', '1')).toBeNull();
    cache.close();
  });

  it('a corrupt cache file is replaced, not fatal (it only costs requests)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cache-'));
    try {
      const file = join(dir, 'scraper-cache.sqlite');
      await writeFile(file, 'this is not a database');
      const log = { warn: vi.fn() };
      const cache = new ScraperCache(file, () => 0, log);
      cache.put('game', '1', { id: '1' });
      expect(cache.get('game', '1')).toEqual({ id: '1' });
      expect(log.warn).toHaveBeenCalledTimes(1);
      cache.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a row that is not JSON reads as a miss', () => {
    const cache = new ScraperCache(':memory:', () => 0, { warn: vi.fn() });
    cache.put('game', '1', 'x');
    const db = Reflect.get(cache, 'db') as Database.Database;
    db.prepare("update entries set data = '{oops'").run();
    expect(cache.get('game', '1')).toBeNull();
    cache.close();
  });
});
