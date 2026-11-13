import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { apiError } from '../errors.ts';
import { checkKey, type FileStore, type StoredFile } from './FileStore.ts';
import { encodePath, presignUrl, signHeaders, type S3Credentials } from './sigv4.ts';

export interface S3Config extends S3Credentials {
  /** e.g. `https://<account>.r2.cloudflarestorage.com` or `http://127.0.0.1:9000` (MinIO). */
  endpoint: string;
  bucket: string;
  /** Where an upload is spooled (hashed, size-checked) before it is sent with its length. */
  tempDir: string;
  clock?: () => Date;
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};
const unescapeXml = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);

const tag = (xml: string, name: string) =>
  new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1];

function missing(key: string): Error {
  return Object.assign(new Error(`No such file: ${key}`), { code: 'ENOENT' });
}

function failed(method: string, status: number | undefined): Error {
  return Object.assign(new Error(`S3 ${method} failed with ${String(status)}`), {
    code: 'S3_ERROR',
    status,
  });
}

/** `attachment; filename="…"` with an ASCII fallback and the UTF-8 name (RFC 6266). */
function disposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Catalog files in an S3-compatible bucket (Cloudflare R2 in production, MinIO in CI; D40, D57),
 * signed with SigV4 over node:http(s). Path-style URLs (`<endpoint>/<bucket>/<key>`). Downloads
 * go straight to the bucket through presigned URLs.
 */
export class S3Store implements FileStore {
  readonly #config: S3Config;
  readonly #clock: () => Date;

  constructor(config: S3Config) {
    this.#config = { ...config, endpoint: config.endpoint.replace(/\/+$/, '') };
    this.#clock = config.clock ?? (() => new Date());
  }

  #url(key: string | null, query: Record<string, string> = {}): URL {
    if (key !== null) checkKey(key);
    const path = key === null ? this.#config.bucket : `${this.#config.bucket}/${key}`;
    const url = new URL(`${this.#config.endpoint}/${encodePath(path)}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    return url;
  }

  #send(
    method: string,
    url: URL,
    o: { headers?: Record<string, string>; body?: Readable } = {},
  ): Promise<IncomingMessage> {
    const headers = signHeaders({
      method,
      url,
      headers: o.headers ?? {},
      creds: this.#config,
      now: this.#clock(),
    });
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const req = send(url, { method, headers }, resolve);
      req.on('error', reject);
      if (o.body) o.body.on('error', (error) => req.destroy(error)).pipe(req);
      else req.end();
    });
  }

  async put(key: string, body: Readable, limit: number): Promise<{ size: number; sha256: string }> {
    const url = this.#url(key);
    await mkdir(this.#config.tempDir, { recursive: true });
    const temp = join(this.#config.tempDir, `${randomUUID()}.upload`);
    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        size += chunk.length;
        if (size > limit) {
          done(apiError('VALIDATION_FAILED', 'The file is too large.', { reason: 'tooLarge' }));
          return;
        }
        hash.update(chunk);
        done(null, chunk);
      },
    });
    try {
      await pipeline(body, meter, createWriteStream(temp));
      // One PUT with its length (catalog files are at most 4 GiB, under S3's 5 GiB single PUT).
      const response = await this.#send('PUT', url, {
        headers: { 'content-length': String(size) },
        body: createReadStream(temp),
      });
      response.resume();
      if (response.statusCode !== 200) throw failed('PUT', response.statusCode);
    } finally {
      await rm(temp, { force: true });
    }
    return { size, sha256: hash.digest('hex') };
  }

  async open(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const response = await this.#send('GET', this.#url(key), {
      headers: range ? { range: `bytes=${String(range.start)}-${String(range.end)}` } : {},
    });
    if (response.statusCode === 200 || response.statusCode === 206) return response;
    response.resume();
    throw response.statusCode === 404 ? missing(key) : failed('GET', response.statusCode);
  }

  async size(key: string): Promise<number | null> {
    const response = await this.#send('HEAD', this.#url(key));
    response.resume();
    if (response.statusCode === 404) return null;
    if (response.statusCode !== 200) throw failed('HEAD', response.statusCode);
    return Number(response.headers['content-length'] ?? 0);
  }

  async delete(key: string): Promise<void> {
    const response = await this.#send('DELETE', this.#url(key));
    response.resume();
    if (![200, 204, 404].includes(response.statusCode ?? 0)) {
      throw failed('DELETE', response.statusCode);
    }
  }

  downloadUrl(key: string, opts: { expiresInSeconds: number; filename?: string }): string {
    return presignUrl({
      method: 'GET',
      url: this.#url(key),
      creds: this.#config,
      now: this.#clock(),
      expiresInSeconds: opts.expiresInSeconds,
      ...(opts.filename
        ? { query: { 'response-content-disposition': disposition(opts.filename) } }
        : {}),
    });
  }

  /** Creates the bucket (provisioning, CI); one that exists already is fine. */
  async createBucket(): Promise<void> {
    const response = await this.#send('PUT', this.#url(null));
    response.resume();
    if (response.statusCode !== 200 && response.statusCode !== 409) {
      throw failed('CreateBucket', response.statusCode);
    }
  }

  /** ListObjectsV2, page by page. */
  async *list(prefix: string): AsyncIterable<StoredFile> {
    let token: string | undefined;
    do {
      const query: Record<string, string> = { 'list-type': '2', prefix };
      if (token) query['continuation-token'] = token;
      const response = await this.#send('GET', this.#url(null, query));
      const xml = await text(response);
      if (response.statusCode !== 200) throw failed('LIST', response.statusCode);
      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const entry = match[1] ?? '';
        const key = tag(entry, 'Key');
        if (key === undefined) continue;
        yield {
          key: unescapeXml(key),
          size: Number(tag(entry, 'Size') ?? 0),
          modifiedAt: new Date(tag(entry, 'LastModified') ?? 0),
        };
      }
      token =
        tag(xml, 'IsTruncated') === 'true'
          ? unescapeXml(tag(xml, 'NextContinuationToken') ?? '')
          : undefined;
    } while (token);
  }
}
