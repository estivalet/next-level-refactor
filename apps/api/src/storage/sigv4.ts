import { createHash, createHmac } from 'node:crypto';

// AWS Signature Version 4 for S3-compatible stores (R2, MinIO; D57), on node:crypto: header
// signing for the API's own requests, query signing for presigned download URLs.

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** `auto` for R2. */
  region: string;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();
export const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** RFC 3986 percent-encoding, as SigV4 wants it (`~` kept, `!'()*` encoded). */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** A URL path with each segment encoded (`/` kept). */
export function encodePath(path: string): string {
  return path.split('/').map(uriEncode).join('/');
}

function stamps(now: Date) {
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return { amzDate, date: amzDate.slice(0, 8) };
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => [uriEncode(key), uriEncode(value)] as const)
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function signature(
  creds: S3Credentials,
  date: string,
  amzDate: string,
  scope: string,
  canonicalRequest: string,
): string {
  const kDate = hmac(`AWS4${creds.secretAccessKey}`, date);
  const kRegion = hmac(kDate, creds.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const toSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  return hmac(kSigning, toSign).toString('hex');
}

/** Query parameters already on `url` are read from it (its `search`), decoded. */
function queryOf(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}

/**
 * A presigned URL (query authentication): anyone holding it may `method` the object until it
 * expires. `url`'s pathname must already be encoded (encodePath).
 */
export function presignUrl(o: {
  method: string;
  url: URL;
  creds: S3Credentials;
  now: Date;
  expiresInSeconds: number;
  query?: Record<string, string>;
}): string {
  const { amzDate, date } = stamps(o.now);
  const scope = `${date}/${o.creds.region}/s3/aws4_request`;
  const params: Record<string, string> = {
    ...queryOf(o.url),
    ...o.query,
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${o.creds.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(o.expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = canonicalQuery(params);
  const canonicalRequest = [
    o.method,
    o.url.pathname,
    query,
    `host:${o.url.host}\n`,
    'host',
    UNSIGNED_PAYLOAD,
  ].join('\n');
  const signed = signature(o.creds, date, amzDate, scope, canonicalRequest);
  return `${o.url.origin}${o.url.pathname}?${query}&X-Amz-Signature=${signed}`;
}

/**
 * The headers for a header-authenticated request: `headers` (lowercase names) plus `host`,
 * `x-amz-date`, `x-amz-content-sha256` and `authorization`.
 */
export function signHeaders(o: {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  creds: S3Credentials;
  now: Date;
  payloadHash?: string;
}): Record<string, string> {
  const { amzDate, date } = stamps(o.now);
  const scope = `${date}/${o.creds.region}/s3/aws4_request`;
  const headers: Record<string, string> = {
    ...o.headers,
    host: o.url.host,
    'x-amz-content-sha256': o.payloadHash ?? UNSIGNED_PAYLOAD,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${(headers[name] ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    o.method,
    o.url.pathname,
    canonicalQuery(queryOf(o.url)),
    canonicalHeaders,
    signedHeaders,
    headers['x-amz-content-sha256'],
  ].join('\n');
  const signed = signature(o.creds, date, amzDate, scope, canonicalRequest);
  return {
    ...headers,
    authorization: `${ALGORITHM} Credential=${o.creds.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signed}`,
  };
}
