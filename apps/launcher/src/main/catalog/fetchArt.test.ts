import { describe, expect, it } from 'vitest';
import { fetchArt } from './fetchArt.ts';

const answer = (bytes: Buffer, type = 'application/octet-stream', status = 200) =>
  (() =>
    Promise.resolve(
      new Response(bytes, { status, headers: { 'content-type': type } }),
    )) as typeof fetch;

describe('catalog art download (FR-CAT-3)', () => {
  it('names the format from the bytes, since the API sends octet-stream', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]);
    expect(await fetchArt('u', answer(png))).toEqual({ bytes: png, format: 'png' });
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 1]);
    expect((await fetchArt('u', answer(jpg)))?.format).toBe('jpg');
  });

  it('videos by their content type; anything unknown or refused is skipped', async () => {
    expect((await fetchArt('u', answer(Buffer.from('x'), 'video/mp4')))?.format).toBe('mp4');
    expect(await fetchArt('u', answer(Buffer.from('<html>')))).toBeNull();
    expect(await fetchArt('u', answer(Buffer.from('x'), 'image/png', 410))).toBeNull();
    const failing = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    expect(await fetchArt('u', failing)).toBeNull();
  });
});
