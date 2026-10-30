import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { body, downloadWorld } from './downloadWorld.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close();
});

async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (!check()) throw new Error('condition never met');
}

describe('catalog downloads (FR-CAT-3, FR-CAT-4, C9, D47)', () => {
  it('US-E2: a queued download reports progress and finishes', async () => {
    const w = await downloadWorld(closers);
    const item = w.add('i1', [body('one'), body('two', 60)]);
    const service = w.make();
    const queued = await service.install('i1');
    expect(queued).toMatchObject({ itemId: 'i1', state: 'queued', bytesTotal: item.size });
    await service.idle();
    const progress = w.eventsOf('downloads.progress');
    expect(progress.some((p) => p.state === 'downloading')).toBe(true);
    expect(progress.at(-1)).toMatchObject({ bytesDone: item.size, bytesTotal: item.size });
    expect(w.eventsOf('downloads.finished')).toEqual([
      { downloadId: queued.id, itemId: 'i1', result: 'installed' },
    ]);
    expect(w.installed[0]?.files.map((f) => [f.fileId, f.sha256])).toEqual(
      item.files.map((f) => [f.id, f.sha256]),
    );
    expect(w.installed[0]?.bytes).toEqual([body('one'), body('two', 60)]);
    expect(service.list()).toEqual([]);
    expect(await readdir(w.dir)).toEqual([]);
  });

  it('installing an item already queued answers the same download', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.hold(w.token('i1'), 10);
    const service = w.make();
    const first = await service.install('i1');
    const again = await service.install('i1');
    expect(again.id).toBe(first.id);
    await service.cancel(first.id);
    await service.idle();
  });

  it('resumes from the .part size after a restart', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.cutAfter(w.token('i1'), 100);
    const first = w.make();
    await first.install('i1');
    await first.idle();
    first.dispose();
    const second = w.make();
    second.start();
    await second.idle();
    expect(w.server.ranges.at(-1)).toBe('bytes=100-');
    expect(w.installed[0]?.bytes).toEqual([body('one')]);
  });

  it('a cut connection pauses with network, not failed, and resumes when back online', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.cutAfter(w.token('i1'), 100);
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'paused', pausedReason: 'network' });
    expect(w.eventsOf('downloads.finished')).toEqual([]);
    service.networkBack();
    await service.idle();
    expect(w.eventsOf('downloads.finished')[0]?.result).toBe('installed');
  });

  it('no API (signed out or offline) pauses with offline', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.state.offline = true;
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'paused', pausedReason: 'offline' });
    w.state.offline = false;
    service.networkBack();
    await service.idle();
    expect(w.installed).toHaveLength(1);
  });

  it('an expired URL is re-requested once; a second refusal fails refused', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.refuse(w.token('i1'), 410);
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(w.state.grantCalls).toBe(2);
    expect(service.list()[0]).toMatchObject({ state: 'failed', error: 'refused' });
    expect(w.eventsOf('downloads.finished')[0]).toMatchObject({
      result: 'failed',
      error: 'refused',
    });
  });

  it('an expired URL that works the second time finishes', async () => {
    const w = await downloadWorld(closers);
    const item = w.add('i1', [body('one')]);
    w.server.refuse('stale-token', 403);
    const file = item.files[0];
    if (!file) throw new Error('no file');
    // The first grant's URL has expired; the default one (asked for again) works.
    w.state.nextGrant = () =>
      Promise.resolve({
        files: [
          {
            fileId: file.id,
            filename: file.filename,
            size: file.size,
            sha256: file.sha256,
            url: w.server.url('stale-token'),
            expiresAt: '2026-10-29T10:10:00.000Z',
          },
        ],
      });
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(w.state.grantCalls).toBe(2);
    expect(w.installed).toHaveLength(1);
  });

  it('C9 / US-E2: a checksum mismatch deletes the file and fails checksum', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')], { badSha: true });
    const service = w.make();
    const queued = await service.install('i1');
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'failed', error: 'checksum' });
    expect(existsSync(join(w.dir, queued.id, 'f1.part'))).toBe(false);
    expect(w.installed).toEqual([]);
  });

  it('less free space than the remaining bytes fails diskFull before downloading', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.state.free = 10;
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'failed', error: 'diskFull' });
    expect(w.server.ranges).toEqual([]);
  });

  it('pause keeps the .part; cancel deletes it and the download', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.hold(w.token('i1'), 50);
    const service = w.make();
    const queued = await service.install('i1');
    const part = join(w.dir, queued.id, 'f1.part');
    // The test clock stands still, so progress events are throttled: watch the disk instead.
    await until(() => existsSync(part) && statSync(part).size >= 50);
    await service.pause(queued.id);
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'paused', pausedReason: 'user' });
    expect(existsSync(part)).toBe(true);
    await service.cancel(queued.id);
    expect(service.list()).toEqual([]);
    expect(existsSync(join(w.dir, queued.id))).toBe(false);
    expect(w.eventsOf('downloads.finished').at(-1)).toMatchObject({ result: 'cancelled' });
  });

  it('a failed download resumes from what it kept', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.state.free = 10;
    const service = w.make();
    const queued = await service.install('i1');
    await service.idle();
    w.state.free = 10 ** 12;
    await writeFile(join(w.dir, queued.id, 'f1.part'), body('one').subarray(0, 30));
    await service.resume(queued.id);
    await service.idle();
    expect(w.server.ranges).toEqual(['bytes=30-']);
    expect(w.installed).toHaveLength(1);
  });

  it('Review Focus 2: a file id from the API that would leave the downloads folder is refused', async () => {
    const w = await downloadWorld(closers);
    const item = w.add('i1', [body('one')]);
    const file = item.files[0];
    if (!file) throw new Error('no file');
    const evil = { ...file, id: '..\\..\\escaped' };
    w.setItem({ ...item, files: [evil] });
    w.server.serve('i1-..\\..\\escaped', body('one'));
    const service = w.make();
    await service.install('i1');
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'failed', error: 'refused' });
    expect(existsSync(join(w.dir, '..', 'escaped.part'))).toBe(false);
    expect(w.server.ranges).toEqual([]);
  });

  it('the item is fetched again before installing, so its art URLs are fresh', async () => {
    const w = await downloadWorld(closers);
    const item = w.add('i1', [body('one')]);
    w.setItem({ ...item, media: [{ kind: 'box-front', url: 'stale-url' }] });
    const service = w.make();
    await service.install('i1');
    w.setItem({ ...item, media: [{ kind: 'box-front', url: 'fresh-url' }] });
    await service.idle();
    expect(w.installed[0]?.item.media).toEqual([{ kind: 'box-front', url: 'fresh-url' }]);
  });

  it('cancelling the running download answers at once, even with others queued', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.add('i2', [body('two')]);
    w.server.hold(w.token('i1'), 20);
    w.server.hold(w.token('i2'), 20);
    const service = w.make();
    const first = await service.install('i1');
    const second = await service.install('i2');
    await until(() => existsSync(join(w.dir, first.id, 'f1.part')));
    await service.cancel(first.id);
    expect(service.list().map((d) => d.id)).toEqual([second.id]);
    await service.cancel(second.id);
    await service.idle();
  });

  it('downloads run one at a time in queue order', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.add('i2', [body('two')]);
    const service = w.make();
    await service.install('i1');
    await service.install('i2');
    await service.idle();
    expect(w.timeline).toEqual(['grant i1', 'install i1', 'grant i2', 'install i2']);
  });

  it('cancel during verify stops before install and removes the partial files', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    let open: () => void = () => undefined;
    w.state.verifyGate = new Promise((resolve) => {
      open = resolve;
    });
    const service = w.make();
    const queued = await service.install('i1');
    await until(() => w.state.verifying > 0);
    await service.cancel(queued.id);
    open();
    await service.idle();
    expect(w.installed).toEqual([]);
    expect(service.list()).toEqual([]);
    expect(existsSync(join(w.dir, queued.id))).toBe(false);
    expect(w.eventsOf('downloads.finished').at(-1)).toMatchObject({ result: 'cancelled' });
  });

  it('pause during verify keeps the verified part and resumes without re-downloading', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    let open: () => void = () => undefined;
    w.state.verifyGate = new Promise((resolve) => {
      open = resolve;
    });
    const service = w.make();
    const queued = await service.install('i1');
    await until(() => w.state.verifying > 0);
    await service.pause(queued.id);
    await service.idle();
    expect(service.list()[0]).toMatchObject({ state: 'paused', pausedReason: 'user' });
    expect(w.installed).toEqual([]);
    open();
    w.state.verifyGate = null;
    const requests = w.server.ranges.length;
    await service.resume(queued.id);
    await service.idle();
    expect(w.server.ranges).toHaveLength(requests);
    expect(w.installed[0]?.bytes).toEqual([body('one')]);
  });

  it('a 200 answer to a Range request restarts the count (bytesDone ≤ bytesTotal)', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.state.free = 10;
    const service = w.make();
    const queued = await service.install('i1');
    await service.idle();
    w.state.free = 10 ** 12;
    await writeFile(join(w.dir, queued.id, 'f1.part'), body('one').subarray(0, 30));
    w.server.ignoreRange(w.token('i1'));
    w.server.cutAfter(w.token('i1'), 100);
    await service.resume(queued.id);
    await service.idle();
    expect(w.server.ranges.at(-1)).toBe('bytes=30-');
    expect(service.list()[0]).toMatchObject({ state: 'paused', bytesDone: 100 });
  });

  it('Resume right after Pause resumes (no lost resume)', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.hold(w.token('i1'), 50);
    const service = w.make();
    const queued = await service.install('i1');
    const part = join(w.dir, queued.id, 'f1.part');
    await until(() => existsSync(part) && statSync(part).size >= 50);
    w.server.release(w.token('i1'));
    await service.pause(queued.id);
    await service.resume(queued.id);
    await service.idle();
    expect(w.installed[0]?.bytes).toEqual([body('one')]);
    expect(service.list()).toEqual([]);
  });

  it('cancelling a queued download deletes its row before its folder; the loop never picks it up', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.add('i2', [body('two')]);
    w.server.hold(w.token('i1'), 20);
    const service = w.make();
    const first = await service.install('i1');
    const second = await service.install('i2');
    const cancelling = service.cancel(second.id);
    // Before the folder is touched, the row is already gone: the loop can't pick it up.
    expect(w.repo.get(second.id)).toBeUndefined();
    await cancelling;
    await service.cancel(first.id);
    await service.idle();
    expect(w.timeline).not.toContain('grant i2');
  });

  /** Two queued items, both paused offline; i1's stored item then stops parsing (an update). */
  async function unreadableWorld() {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.add('i2', [body('two')]);
    w.state.offline = true;
    const service = w.make();
    const bad = await service.install('i1');
    await service.install('i2');
    await service.idle();
    await writeFile(join(w.dir, bad.id, 'f1.part'), body('one').subarray(0, 30));
    w.db.$client.prepare(`update downloads set item = '{"old":1}' where id = ?`).run(bad.id);
    return { w, service, bad };
  }

  it('an unreadable row of the same version is repaired from the API and resumes from its parts', async () => {
    const { w, service } = await unreadableWorld();
    w.state.offline = false;
    service.networkBack();
    await service.idle();
    expect(w.installed.map((done) => done.item.id).sort()).toEqual(['i1', 'i2']);
    expect(w.server.ranges).toContain('bytes=30-');
    expect(JSON.stringify(w.logged)).toContain('catalog download unreadable');
  });

  it('an unreadable row is kept, parts and all, while the API cannot be reached', async () => {
    const { w, service, bad } = await unreadableWorld();
    w.state.getUnreachable = true;
    service.networkBack();
    await service.idle();
    expect(w.db.$client.prepare('select count(*) as n from downloads').get()).toEqual({ n: 2 });
    expect(existsSync(join(w.dir, bad.id, 'f1.part'))).toBe(true);
    expect(service.list().map((d) => d.itemId)).toEqual(['i2']);
  });

  it('an unreadable row whose item changed version or left the catalog is dropped; the rest runs', async () => {
    const { w, service, bad } = await unreadableWorld();
    const item = w.add('i1', [body('one, v2')]);
    w.setItem({ ...item, version: 2 });
    w.state.offline = false;
    service.networkBack();
    await service.idle();
    expect(w.installed.map((done) => done.item.id)).toEqual(['i2']);
    expect(w.db.$client.prepare('select count(*) as n from downloads').get()).toEqual({ n: 0 });
    expect(existsSync(join(w.dir, bad.id))).toBe(false);
  });

  it('at start, download folders without a row are removed', async () => {
    const w = await downloadWorld(closers);
    await mkdir(join(w.dir, 'd-orphan'), { recursive: true });
    await writeFile(join(w.dir, 'd-orphan', 'f1.part'), body('lost'));
    const service = w.make();
    service.start();
    await service.idle();
    expect(existsSync(join(w.dir, 'd-orphan'))).toBe(false);
  });

  it('a download folder that cannot be deleted on cancel is logged; the cancel still answers', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.state.offline = true;
    const service = w.make({
      removeDir: () => Promise.reject(Object.assign(new Error('busy'), { code: 'EBUSY' })),
    });
    const queued = await service.install('i1');
    await service.idle();
    await service.cancel(queued.id);
    expect(service.list()).toEqual([]);
    expect(JSON.stringify(w.logged)).toContain('download folder could not be removed');
  });

  it('cancelItem cancels the active download of an item (uninstall, lapse removal)', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.server.hold(w.token('i1'), 20);
    const service = w.make();
    const queued = await service.install('i1');
    await until(() => existsSync(join(w.dir, queued.id, 'f1.part')));
    await service.cancelItem('i1');
    await service.cancelItem('i-none');
    await service.idle();
    expect(service.list()).toEqual([]);
    expect(w.installed).toEqual([]);
  });

  it('download URLs are never logged', async () => {
    const w = await downloadWorld(closers);
    w.add('i1', [body('one')]);
    w.add('i2', [body('two')], { badSha: true });
    w.add('i3', [body('three')]);
    w.server.refuse(w.token('i1'), 410);
    w.server.cutAfter(w.token('i3'), 20);
    const service = w.make();
    for (const id of ['i1', 'i2', 'i3']) await service.install(id);
    await service.idle();
    const logged = JSON.stringify(w.logged);
    expect(logged).toContain('catalog download failed');
    expect(logged).not.toContain('127.0.0.1');
    expect(logged).not.toContain('/v1/files/');
  });
});
