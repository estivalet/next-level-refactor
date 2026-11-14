import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A tiny in-process S3 (path-style PUT/GET/HEAD/DELETE with one Range, ListObjectsV2 in pages of
 * 2) for S3Store's tests where no MinIO runs. It checks that requests are signed, not the
 * signature itself (sigv4.test does that with AWS's examples; CI runs MinIO).
 */
export async function fakeS3(bucket: string) {
  const objects = new Map<string, { body: Buffer; modifiedAt: Date }>();
  const unsigned: string[] = [];
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const auth = request.headers.authorization ?? '';
    const presigned = url.searchParams.get('X-Amz-Signature');
    if (presigned) {
      // Query authentication (a presigned URL): refused once X-Amz-Date + X-Amz-Expires passed.
      const stamp = (url.searchParams.get('X-Amz-Date') ?? '').replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
        '$1-$2-$3T$4:$5:$6Z',
      );
      const expires = Number(url.searchParams.get('X-Amz-Expires'));
      if (Date.parse(stamp) + expires * 1000 < Date.now()) {
        response.writeHead(403).end();
        return;
      }
    } else if (!auth.startsWith('AWS4-HMAC-SHA256 Credential=') || !request.headers['x-amz-date']) {
      unsigned.push(`${request.method ?? ''} ${url.pathname}`);
      response.writeHead(403).end();
      return;
    }
    const parts = url.pathname.split('/').slice(1).map(decodeURIComponent);
    if (parts[0] !== bucket) {
      response.writeHead(404).end();
      return;
    }
    const key = parts.slice(1).join('/');
    if (request.method === 'GET' && key === '') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const after = url.searchParams.get('continuation-token') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix) && k > after).sort();
      const page = keys.slice(0, Number(url.searchParams.get('max-keys') ?? 1000));
      const contents = page
        .map((k) => {
          const object = objects.get(k);
          return `<Contents><Key>${k}</Key><LastModified>${object?.modifiedAt.toISOString() ?? ''}</LastModified><Size>${String(object?.body.length ?? 0)}</Size></Contents>`;
        })
        .join('');
      const truncated = keys.length > page.length;
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end(
        `<?xml version="1.0"?><ListBucketResult>${contents}<IsTruncated>${String(truncated)}</IsTruncated>${
          truncated ? `<NextContinuationToken>${page.at(-1) ?? ''}</NextContinuationToken>` : ''
        }</ListBucketResult>`,
      );
      return;
    }
    if (request.method === 'PUT') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = Buffer.concat(chunks);
        if (Number(request.headers['content-length']) !== body.length) {
          response.writeHead(400).end();
          return;
        }
        objects.set(key, { body, modifiedAt: new Date() });
        response.writeHead(200).end();
      });
      return;
    }
    const object = objects.get(key);
    if (request.method === 'DELETE') {
      objects.delete(key);
      response.writeHead(204).end();
      return;
    }
    if (!object) {
      response.writeHead(404).end();
      return;
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    const end = range?.[2] ? Number(range[2]) + 1 : object.body.length;
    const body = range ? object.body.subarray(Number(range[1]), end) : object.body;
    const disposition = url.searchParams.get('response-content-disposition');
    response.writeHead(range ? 206 : 200, {
      'content-length': String(body.length),
      ...(disposition ? { 'content-disposition': disposition } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${String(port)}`,
    objects,
    unsigned,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
