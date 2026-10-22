// Cases ported from NextLevelOS electron/mediaRange.test.ts @ 3d530b7.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { parseRange, serveFile } from './mediaRange.ts';

describe('parseRange', () => {
  it('FR-THM-6: reads an open-ended range, as Chromium sends when resuming a video', () => {
    expect(parseRange('bytes=34504704-', 40000000)).toEqual({ start: 34504704, end: 39999999 });
  });
  it('FR-THM-6: reads a closed range and clamps the end to the file', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
  });
  it('FR-THM-6: reads a suffix range', () => {
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
  });
  it('FR-THM-6: a start past the end is unsatisfiable', () => {
    expect(parseRange('bytes=2000-', 1000)).toBe('unsatisfiable');
  });
  it('FR-THM-6: headers it does not understand serve the whole file', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull();
    expect(parseRange('items=0-1', 100)).toBeNull();
    expect(parseRange('bytes=5-2', 100)).toBeNull();
  });
});

describe('serveFile', () => {
  let dir: string;
  let cleanup: () => Promise<void>;
  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir('nextlevel-range-'));
    await writeFile(join(dir, 'clip.mp4'), '0123456789');
    await writeFile(join(dir, 'Box Art.PNG'), 'png');
  });
  afterEach(async () => {
    await cleanup();
  });

  it('FR-THM-6: no Range header → 200 with the whole file and its type', async () => {
    const res = await serveFile(join(dir, 'Box Art.PNG'), null);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(await res.text()).toBe('png');
  });

  it('FR-THM-6: a range → 206 with only those bytes', async () => {
    const res = await serveFile(join(dir, 'clip.mp4'), 'bytes=4-');
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 4-9/10');
    expect(res.headers.get('content-length')).toBe('6');
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(await res.text()).toBe('456789');
  });

  it('FR-THM-6: a range past the end → 416', async () => {
    const res = await serveFile(join(dir, 'clip.mp4'), 'bytes=50-');
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */10');
  });

  it('FR-THM-6: a missing file → 404', async () => {
    expect((await serveFile(join(dir, 'gone.png'), null)).status).toBe(404);
  });
});
