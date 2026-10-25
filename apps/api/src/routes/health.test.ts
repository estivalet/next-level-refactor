import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

describe('GET /v1/health (api-spec §2, deployment smoke test)', () => {
  it('answers without auth with the version and the database state', async () => {
    const { app, close } = await createTestApp();
    closers.push(close);
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', version: pkg.version, db: 'ok' });
  });
});
