import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { downloadFile } from './downloadFile.ts';
import { fakeFilesServer } from './fakeFilesServer.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

const BODY = Buffer.from('NEXTLEVEL TEST FIXTURE star hopper\n'.repeat(30));

async function setup() {
  const temp = await tempDir('nextlevel-download-');
  const part = join(temp.dir, 'f1.part');
  const server = await fakeFilesServer({
    kept: () =>
      stat(part).then(
        (s) => s.size,
        () => 0,
      ),
  });
  closers.push(server.close, temp.cleanup);
  server.serve('t1', BODY);
  const run = (token = 't1', signal = new AbortController().signal) =>
    downloadFile({ url: server.url(token), part, expectedSize: BODY.length, fetch, signal });
  return { server, part, run };
}

describe('one catalog file (FR-CAT-4, Review Focus 3)', () => {
  it('downloads the whole file into the .part', async () => {
    const t = await setup();
    expect(await t.run()).toBe('done');
    expect(await readFile(t.part)).toEqual(BODY);
    expect(t.server.ranges).toEqual([undefined]);
  });

  it('resumes from the .part size with a Range request', async () => {
    const t = await setup();
    await writeFile(t.part, BODY.subarray(0, 100));
    expect(await t.run()).toBe('done');
    expect(t.server.ranges).toEqual(['bytes=100-']);
    expect(await readFile(t.part)).toEqual(BODY);
  });

  it('a cut connection keeps what arrived and answers network', async () => {
    const t = await setup();
    t.server.cutAfter('t1', 200);
    expect(await t.run()).toBe('network');
    const kept = (await stat(t.part)).size;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(BODY.length);
    expect(await t.run()).toBe('done');
    expect(await readFile(t.part)).toEqual(BODY);
  });

  it('FR-CAT-4: a cut is only made once the client has the bytes, however late it reads', async () => {
    // A slow runner: the body is read well after the response arrived (CI run 43626030496).
    const t = await setup();
    t.server.cutAfter('t1', 200);
    const late: typeof fetch = async (url, init) => {
      const response = await fetch(url, init);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return response;
    };
    const result = await downloadFile({
      url: t.server.url('t1'),
      part: t.part,
      expectedSize: BODY.length,
      fetch: late,
      signal: new AbortController().signal,
    });
    expect(result).toBe('network');
    expect((await stat(t.part)).size).toBe(200);
  });

  it.each([401, 403, 410, 404])('a %i from the files route is an expired URL', async (status) => {
    const t = await setup();
    t.server.refuse('t1', status);
    expect(await t.run()).toBe('expired');
  });

  it('an unreachable server is network', async () => {
    const t = await setup();
    await t.server.close();
    expect(await t.run()).toBe('network');
  });

  it('a .part already complete is done without a request', async () => {
    const t = await setup();
    await writeFile(t.part, BODY);
    expect(await t.run()).toBe('done');
    expect(t.server.ranges).toEqual([]);
  });

  it('a server that ignores the Range starts the file over', async () => {
    const t = await setup();
    await writeFile(t.part, Buffer.from('stale bytes'));
    // A whole-file 200 answers a ranged request: the part is rewritten, not appended to.
    const ignoring: typeof fetch = (url, init) => fetch(url, { ...init, headers: {} });
    const result = await downloadFile({
      url: t.server.url('t1'),
      part: t.part,
      expectedSize: BODY.length,
      fetch: ignoring,
      signal: new AbortController().signal,
    });
    expect(result).toBe('done');
    expect(await readFile(t.part)).toEqual(BODY);
  });

  it('an abort (pause or cancel) stops it and rejects with the abort', async () => {
    const t = await setup();
    const controller = new AbortController();
    controller.abort();
    await expect(t.run('t1', controller.signal)).rejects.toThrow();
  });
});
