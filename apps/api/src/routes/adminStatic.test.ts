import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/testApp.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function setup() {
  const dist = await mkdtemp(join(tmpdir(), 'nextlevel-admin-dist-'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Admin</title>');
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, 'assets', 'app.js'), 'console.log(1)');
  await writeFile(join(tmpdir(), 'nextlevel-outside.txt'), 'secret');
  const test = await createTestApp({ rawEnv: { ADMIN_DIST: dist } });
  cleanups.push(
    test.close,
    () => rm(dist, { recursive: true, force: true }),
    () => rm(join(tmpdir(), 'nextlevel-outside.txt'), { force: true }),
  );
  return test.app;
}

describe('admin console files (architecture §6: one origin)', () => {
  it('serves files, and index.html for any other page path', async () => {
    const app = await setup();
    const js = await app.inject({ url: '/assets/app.js' });
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect(js.body).toBe('console.log(1)');
    for (const url of ['/', '/users', '/users/abc']) {
      const page = await app.inject({ url });
      expect(page.statusCode, url).toBe(200);
      expect(page.body).toContain('<title>Admin</title>');
    }
  });

  it('API paths stay JSON 404s', async () => {
    const app = await setup();
    const response = await app.inject({ url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('a path that climbs out of the folder never reads outside it', async () => {
    const app = await setup();
    for (const url of [
      '/../nextlevel-outside.txt',
      '/%2e%2e/nextlevel-outside.txt',
      '/..%5cnextlevel-outside.txt',
    ]) {
      const response = await app.inject({ url });
      expect(response.body, url).not.toContain('secret');
    }
  });

  it('a malformed %-escape gets the API error envelope, on pages and API paths alike', async () => {
    const app = await setup();
    for (const url of ['/%E0%A4%A', '/v1/admin/users/%ZZ']) {
      const response = await app.inject({ url });
      expect(response.statusCode, url).toBe(400);
      const body = response.json<{ error: Record<string, unknown> }>();
      expect(Object.keys(body.error).sort(), url).toEqual(['code', 'message', 'requestId']);
      expect(body.error, url).toMatchObject({
        code: 'VALIDATION_FAILED',
        requestId: response.headers['x-request-id'],
      });
    }
  });

  it('hashed assets are cached for a year; pages are revalidated', async () => {
    const app = await setup();
    const js = await app.inject({ url: '/assets/app.js' });
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const url of ['/', '/index.html', '/users']) {
      const page = await app.inject({ url });
      expect(page.headers['cache-control'], url).toBe('no-cache');
    }
  });
});
