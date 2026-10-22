// Cases ported from NextLevelOS src/themes/engine/systemInfo.test.ts @ 3d530b7.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSystemInfo, resetSystemInfoCache } from './systemInfo.ts';

type Entry = unknown;
const BAD_JSON = Symbol('bad json');

function stubFetch(map: Record<string, Entry>) {
  const fn = vi.fn((url: string) => {
    if (!(url in map)) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    const value = map[url];
    if (value instanceof Error) return Promise.reject(value);
    if (value === BAD_JSON) {
      return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('loadSystemInfo (FR-THM-1, FR-THM-2)', () => {
  beforeEach(() => {
    resetSystemInfoCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no candidates → null without fetching', async () => {
    const fn = stubFetch({});
    expect(await loadSystemInfo([])).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('the first candidate with a description wins', async () => {
    stubFetch({ a: { description: 'Pack text' }, b: { description: 'Assets text' } });
    expect(await loadSystemInfo(['a', 'b'])).toEqual({ description: 'Pack text' });
  });

  it('falls through a missing file, a missing key, bad JSON and a rejected fetch', async () => {
    stubFetch({
      b: { name: 'x' },
      c: BAD_JSON,
      d: new Error('net'),
      e: { description: '  Real  ' },
    });
    expect(await loadSystemInfo(['a', 'b', 'c', 'd', 'e'])).toEqual({ description: 'Real' });
  });

  it('null when nothing is usable (empty description, non-object JSON)', async () => {
    stubFetch({ a: { description: '   ' }, b: null, c: ['x'] });
    expect(await loadSystemInfo(['a', 'b', 'c'])).toBeNull();
  });

  it('caches per candidate list, null included', async () => {
    const fn = stubFetch({ a: { description: 'T' } });
    await loadSystemInfo(['a']);
    await loadSystemInfo(['a']);
    await loadSystemInfo(['z']);
    await loadSystemInfo(['z']);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
