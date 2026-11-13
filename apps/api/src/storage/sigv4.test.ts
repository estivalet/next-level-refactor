import { describe, expect, it } from 'vitest';
import { presignUrl, signHeaders } from './sigv4.ts';

// The worked examples of AWS Signature Version 4 for S3 ("Authenticating Requests: Using Query
// Parameters" and "…: Using the Authorization Header", GET Object), with AWS's example keys.
const creds = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
};
const at = new Date('2013-05-24T00:00:00.000Z');

describe('SigV4 for S3 (D57)', () => {
  it("a presigned GET matches AWS's worked example", () => {
    const url = presignUrl({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      creds,
      now: at,
      expiresInSeconds: 86400,
    });
    expect(new URL(url).searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    expect(new URL(url).searchParams.get('X-Amz-Credential')).toBe(
      'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
    );
  });

  it("a header-signed ranged GET matches AWS's worked example", () => {
    const headers = signHeaders({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { range: 'bytes=0-9' },
      creds,
      now: at,
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });
    expect(headers['authorization']).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('extra query parameters (a download filename) are signed in canonical order', () => {
    const url = new URL(
      presignUrl({
        method: 'GET',
        url: new URL('https://acct.r2.cloudflarestorage.com/bucket/files/i1/f1'),
        creds: { ...creds, region: 'auto' },
        now: at,
        expiresInSeconds: 600,
        query: { 'response-content-disposition': 'attachment; filename="Game (USA).zip"' },
      }),
    );
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="Game (USA).zip"',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });
});
