import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { fakeS3 } from './fakeS3.ts';
import { fileStoreContract } from './FileStore.contract.ts';
import { S3Store } from './S3Store.ts';

const creds = { accessKeyId: 'test-key', secretAccessKey: 'test-secret', region: 'auto' };

async function fakeSubject() {
  const s3 = await fakeS3('catalog');
  const tempDir = await mkdtemp(join(tmpdir(), 'nextlevel-s3-'));
  return {
    s3,
    store: new S3Store({ ...creds, endpoint: s3.endpoint, bucket: 'catalog', tempDir }),
    cleanup: async () => {
      await s3.close();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

fileStoreContract('S3Store (in-process fake S3)', fakeSubject);

// A real S3-compatible store (CI starts MinIO and sets these; R2 works the same way).
const real = process.env['S3_TEST_ENDPOINT'];
if (real) {
  const bucket = process.env['S3_TEST_BUCKET'] ?? 'nextlevel-test';
  const realCreds = {
    accessKeyId: process.env['S3_TEST_ACCESS_KEY_ID'] ?? 'minioadmin',
    secretAccessKey: process.env['S3_TEST_SECRET_ACCESS_KEY'] ?? 'minioadmin',
    region: process.env['S3_TEST_REGION'] ?? 'us-east-1',
  };
  beforeAll(async () => {
    await new S3Store({ ...realCreds, endpoint: real, bucket, tempDir: tmpdir() }).createBucket();
  });
  fileStoreContract(`S3Store (${real})`, async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'nextlevel-s3-'));
    return {
      store: new S3Store({ ...realCreds, endpoint: real, bucket, tempDir }),
      cleanup: () => rm(tempDir, { recursive: true, force: true }),
    };
  });
}

describe('S3Store (D57)', () => {
  it('every request is signed', async () => {
    const { s3, store, cleanup } = await fakeSubject();
    try {
      await store.size('files/i1/f1');
      expect(s3.unsigned).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  it('downloadUrl is a presigned GET of the key that names the download', () => {
    const store = new S3Store({
      ...creds,
      endpoint: 'https://acct.r2.cloudflarestorage.com/',
      bucket: 'catalog',
      tempDir: tmpdir(),
      clock: () => new Date('2026-11-14T10:00:00.000Z'),
    });
    const url = new URL(
      store.downloadUrl('files/i1/f1-x', { expiresInSeconds: 600, filename: 'Café (USA).zip' }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://acct.r2.cloudflarestorage.com/catalog/files/i1/f1-x',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261114T100000Z');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename="Caf_ (USA).zip"; filename*=UTF-8''Caf%C3%A9%20(USA).zip`,
    );
  });
});
