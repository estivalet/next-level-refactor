import type { CatalogItem, DownloadGrant } from '@nextlevel/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogWorld } from '../../test/catalogPlayer.ts';
import { createTestApp } from '../../test/testApp.ts';
import { fakeS3 } from '../storage/fakeS3.ts';
import { S3Store } from '../storage/S3Store.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0).reverse()) await close();
});

async function setup() {
  const s3 = await fakeS3('catalog');
  const tempDir = await mkdtemp(join(tmpdir(), 'nextlevel-s3-'));
  closers.push(async () => {
    await s3.close();
    await rm(tempDir, { recursive: true, force: true });
  });
  const test = await createTestApp({
    files: () =>
      new S3Store({
        endpoint: s3.endpoint,
        bucket: 'catalog',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        region: 'auto',
        tempDir,
        clock: () => new Date('2026-10-25T12:00:00.000Z'),
      }),
  });
  closers.push(test.close);
  const world = await catalogWorld(test.app);
  const id = await world.publish('star-hopper');
  await world.planScopes(['homebrew-8bit']);
  return { ...test, ...world, s3, id };
}

describe('catalog on an S3 store (D57)', () => {
  it('downloads with FILE_STORE=s3 return presigned URLs valid 10 min (art 1 h)', async () => {
    const t = await setup();
    await t.admin.raw(`${t.admin.base(t.id)}/media/box-front`, Buffer.from('png'), 'image/png');
    const response = await t.post(`/v1/catalog/items/${t.id}/downloads`, {
      deviceId: t.player.deviceId,
    });
    expect(response.statusCode).toBe(200);
    const file = response.json<DownloadGrant>().files[0];
    const url = new URL(file?.url ?? '');
    expect(url.origin).toBe(t.s3.endpoint);
    expect(url.pathname).toMatch(/^\/catalog\/files\/[\w-]+\/[\w-]+$/);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('response-content-disposition')).toContain('Star Hopper.nes');
    // The bucket has the file the URL names (the upload went to S3, not the disk).
    expect(t.s3.objects.has(url.pathname.replace('/catalog/', ''))).toBe(true);
    // Each issue is still logged (FR-CAT-6).
    expect(t.db.$client.prepare('select count(*) from downloads').pluck().get()).toBe(1);

    const item = (await t.get(`/v1/catalog/items/${t.id}`)).json<CatalogItem>();
    const art = new URL(item.media[0]?.url ?? '');
    expect(art.origin).toBe(t.s3.endpoint);
    expect(art.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(item.boxArt).toBe(item.media[0]?.url);
  });
});
