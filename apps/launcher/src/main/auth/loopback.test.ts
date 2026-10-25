import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { apiBaseUrl } from './apiUrl.ts';
import { startLoopback, type Loopback } from './loopback.ts';
import { createPkce } from './pkce.ts';

const open: Loopback[] = [];
afterEach(() => {
  for (const loop of open.splice(0)) loop.close();
});

async function listen(timeoutMs = 5000) {
  const loop = await startLoopback({
    state: 'good-state',
    timeoutMs,
    page: (outcome) => `<p>${outcome}</p>`,
  });
  open.push(loop);
  return loop;
}

const settle = <T>(promise: Promise<T>, ms = 100) =>
  Promise.race([
    promise,
    new Promise<'pending'>((resolve) => setTimeout(() => { resolve('pending'); }, ms)),
  ]);

describe('PKCE (RFC 7636, ADR-006)', () => {
  it('the challenge is base64url(SHA-256(verifier)); verifier and state are random', () => {
    const a = createPkce();
    const b = createPkce();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(a.challenge).toBe(createHash('sha256').update(a.verifier).digest('base64url'));
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
  });
});

describe('loopback listener (RFC 8252, FR-AUTH-2, Review Focus 3)', () => {
  it('listens on 127.0.0.1 with a random port and path /callback', async () => {
    const loop = await listen();
    expect(loop.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
  });

  it('the matching callback gives the code and the page; nothing answers after it', async () => {
    const loop = await listen();
    const response = await fetch(`${loop.redirectUri}?code=the-code&state=good-state`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('ok');
    expect(await loop.result).toEqual({ code: 'the-code' });
    const again = await fetch(`${loop.redirectUri}?code=other&state=good-state`).then(
      (r) => r.status,
      () => 'closed',
    );
    expect(again).not.toBe(200);
  });

  it('a wrong state, a missing code and other paths are 404 and keep waiting', async () => {
    const loop = await listen();
    const base = loop.redirectUri.replace('/callback', '');
    for (const url of [
      `${loop.redirectUri}?code=x&state=bad-state`,
      `${loop.redirectUri}?state=good-state`,
      `${base}/favicon.ico`,
      `${base}/callback/extra?code=x&state=good-state`,
    ]) {
      expect((await fetch(url)).status, url).toBe(404);
    }
    expect(await settle(loop.result)).toBe('pending');
  });

  it('access_denied with the right state is a cancel', async () => {
    const loop = await listen();
    const response = await fetch(`${loop.redirectUri}?error=access_denied&state=good-state`);
    expect(await response.text()).toContain('cancelled');
    expect(await loop.result).toEqual({ cancelled: true });
  });

  it('no callback in time is a timeout, and the port is closed', async () => {
    const loop = await listen(50);
    expect(await loop.result).toEqual({ timeout: true });
    const after = await fetch(`${loop.redirectUri}?code=x&state=good-state`).then(
      (r) => r.status,
      () => 'closed',
    );
    expect(after).toBe('closed');
  });

  it('close() while waiting is a cancel', async () => {
    const loop = await listen();
    loop.close();
    expect(await loop.result).toEqual({ cancelled: true });
  });
});

describe('API address (D25)', () => {
  it('packaged builds use the built-in address; development builds honour the override', () => {
    expect(
      apiBaseUrl({ isPackaged: true, override: 'http://x:1', built: 'https://api.test' }),
    ).toBe('https://api.test');
    expect(
      apiBaseUrl({ isPackaged: false, override: 'http://127.0.0.1:9/', built: undefined }),
    ).toBe('http://127.0.0.1:9');
    expect(apiBaseUrl({ isPackaged: false, override: undefined, built: undefined })).toBe(
      'http://localhost:4000',
    );
  });
});
