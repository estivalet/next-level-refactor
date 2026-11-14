import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
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

type StoreOf = (opts: { clock?: () => Date; pageSize?: number }) => Promise<{
  store: S3Store;
  cleanup: () => Promise<void>;
}>;

/** What only an S3 store does: presigned downloads and paged listings (D57). */
function s3Cases(name: string, make: StoreOf): void {
  describe(`S3Store downloads and listings: ${name} (D57)`, () => {
    const prefix = () => `cases-${String(Date.now())}-${String(Math.random()).slice(2, 8)}`;

    it('a presigned GET downloads the file under its name; a Range gets 206 from there', async () => {
      const { store, cleanup } = await make({});
      try {
        const key = `files/${prefix()}/f1`;
        await store.put(key, Readable.from(['0123456789']), 1024);
        const url = store.downloadUrl(key, {
          expiresInSeconds: 600,
          filename: "Café (USA) - Tom's.zip",
        });
        const whole = await fetch(url);
        expect(whole.status).toBe(200);
        expect(await whole.text()).toBe('0123456789');
        expect(whole.headers.get('content-disposition') ?? '').toContain('attachment');
        const ranged = await fetch(url, { headers: { range: 'bytes=3-' } });
        expect(ranged.status).toBe(206);
        expect(await ranged.text()).toBe('3456789');
        await store.delete(key);
      } finally {
        await cleanup();
      }
    });

    it('an expired presigned URL is refused (403)', async () => {
      const past = new Date(Date.now() - 2 * 3600_000);
      const { store, cleanup } = await make({ clock: () => past });
      const { store: writer, cleanup: done } = await make({});
      try {
        const key = `files/${prefix()}/f1`;
        await writer.put(key, Readable.from(['x']), 1024);
        const response = await fetch(store.downloadUrl(key, { expiresInSeconds: 600 }));
        expect(response.status).toBe(403);
        await writer.delete(key);
      } finally {
        await cleanup();
        await done();
      }
    });

    it('list follows continuation pages', async () => {
      const { store, cleanup } = await make({ pageSize: 2 });
      try {
        const base = `media/${prefix()}`;
        for (const n of ['a', 'b', 'c', 'd', 'e']) {
          await store.put(`${base}/${n}`, Readable.from([n]), 1024);
        }
        const keys: string[] = [];
        for await (const file of store.list(`${base}/`)) keys.push(file.key);
        expect(keys.sort()).toEqual(['a', 'b', 'c', 'd', 'e'].map((n) => `${base}/${n}`));
        for (const key of keys) await store.delete(key);
      } finally {
        await cleanup();
      }
    });
  });
}

s3Cases('in-process fake S3', async (opts) => {
  const s3 = await fakeS3('catalog');
  const tempDir = await mkdtemp(join(tmpdir(), 'nextlevel-s3-'));
  return {
    store: new S3Store({ ...creds, endpoint: s3.endpoint, bucket: 'catalog', tempDir, ...opts }),
    cleanup: async () => {
      await s3.close();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
});

// A real S3-compatible store (R2, MinIO, …) when S3_TEST_ENDPOINT is set. Not run in CI: the S3
// store is on hold (owner, 2026-11-14) and MinIO's binaries are no longer published.
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
  s3Cases(real, async (opts) => {
    const tempDir = await mkdtemp(join(tmpdir(), 'nextlevel-s3-'));
    return {
      store: new S3Store({ ...realCreds, endpoint: real, bucket, tempDir, ...opts }),
      cleanup: () => rm(tempDir, { recursive: true, force: true }),
    };
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

  it('a store that accepts the connection and never answers times out instead of hanging', async () => {
    const sockets: Socket[] = [];
    const server = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const store = new S3Store({
        ...creds,
        endpoint: `http://127.0.0.1:${String(port)}`,
        bucket: 'catalog',
        tempDir: tmpdir(),
        timeoutMs: 200,
      });
      await expect(store.size('files/i1/f1')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });
});
