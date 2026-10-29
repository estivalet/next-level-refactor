import { afterEach, describe, expect, it } from 'vitest';
import { catalogItem } from '../catalog/testing.ts';
import { DownloadRepository } from './DownloadRepository.ts';
import { tempLibrary } from './testing.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function repo() {
  const library = await tempLibrary();
  closers.push(library.cleanup);
  return new DownloadRepository(library.db);
}

describe('download queue rows (FR-CAT-4)', () => {
  it('enqueue keeps the item; the oldest queued row is next; list shows the summaries', async () => {
    const downloads = await repo();
    downloads.enqueue('d1', catalogItem(), '2026-10-29T10:00:00.000Z');
    downloads.enqueue(
      'd2',
      catalogItem({ id: 'i2', title: 'Moss Garden' }),
      '2026-10-29T10:00:01.000Z',
    );
    expect(downloads.next()?.id).toBe('d1');
    expect(downloads.get('d1')?.item.title).toBe('Star Hopper');
    expect(downloads.list().map((d) => [d.id, d.itemId, d.state, d.bytesTotal])).toEqual([
      ['d1', 'i1', 'queued', 30],
      ['d2', 'i2', 'queued', 30],
    ]);
    downloads.update('d1', { state: 'paused', pausedReason: 'user' }, '2026-10-29T10:01:00.000Z');
    expect(downloads.next()?.id).toBe('d2');
    expect(downloads.activeFor('i1')?.id).toBe('d1');
  });

  it('a download interrupted by quitting goes back to the queue; delete removes it', async () => {
    const downloads = await repo();
    downloads.enqueue('d1', catalogItem(), '2026-10-29T10:00:00.000Z');
    downloads.update('d1', { state: 'downloading', bytesDone: 12 }, '2026-10-29T10:00:05.000Z');
    downloads.requeueInterrupted('2026-10-29T11:00:00.000Z');
    expect(downloads.get('d1')).toMatchObject({ state: 'queued', bytesDone: 12 });
    downloads.delete('d1');
    expect(downloads.list()).toEqual([]);
    expect(downloads.activeFor('i1')).toBeUndefined();
  });

  it('a failed download is listed with its reason and is not active', async () => {
    const downloads = await repo();
    downloads.enqueue('d1', catalogItem(), '2026-10-29T10:00:00.000Z');
    downloads.update('d1', { state: 'failed', error: 'checksum' }, '2026-10-29T10:00:05.000Z');
    expect(downloads.list()[0]).toMatchObject({ state: 'failed', error: 'checksum' });
    expect(downloads.activeFor('i1')).toBeUndefined();
    expect(downloads.failedFor('i1')?.id).toBe('d1');
  });
});
