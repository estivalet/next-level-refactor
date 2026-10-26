import { ApiErrorEnvelopeSchema } from '@nextlevel/shared';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { logOptions } from './log.ts';
import { createTestApp } from '../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  return test;
}

describe('API pipeline (api-spec §1, architecture §5.2)', () => {
  it('an unknown route is a NOT_FOUND envelope carrying the request id', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(response.statusCode).toBe(404);
    const body = ApiErrorEnvelopeSchema.parse(response.json());
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(response.headers['x-request-id']);
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a body that fails its schema is VALIDATION_FAILED with the issues', async () => {
    const { app } = await setup();
    app.withTypeProvider<ZodTypeProvider>().post(
      '/v1/test/echo',
      {
        config: { role: 'public' },
        schema: { body: z.strictObject({ name: z.string().min(2) }) },
      },
      (request) => request.body,
    );
    const response = await app.inject({
      method: 'POST',
      url: '/v1/test/echo',
      payload: { name: 'x' },
    });
    expect(response.statusCode).toBe(400);
    const body = ApiErrorEnvelopeSchema.parse(response.json());
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect((body.error.details as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
  });

  it('malformed JSON is VALIDATION_FAILED, not INTERNAL', async () => {
    const { app } = await setup();
    app.post('/v1/test/json', { config: { role: 'public' } }, () => ({ ok: true }));
    const response = await app.inject({
      method: 'POST',
      url: '/v1/test/json',
      headers: { 'content-type': 'application/json' },
      payload: '{nope',
    });
    expect(response.statusCode).toBe(400);
    expect(ApiErrorEnvelopeSchema.parse(response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('an unexpected error is INTERNAL and never shows its message', async () => {
    const { app } = await setup();
    app.get('/v1/test/boom', { config: { role: 'public' } }, () => {
      throw new Error('secret table name');
    });
    const response = await app.inject({ method: 'GET', url: '/v1/test/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret table name');
    expect(ApiErrorEnvelopeSchema.parse(response.json()).error.code).toBe('INTERNAL');
  });

  it('a route without a declared role cannot be registered (security §2)', async () => {
    const { app } = await setup();
    expect(() => app.get('/v1/test/open', () => 'x')).toThrow(/role/);
  });

  it('security headers are set (helmet)', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /v1/openapi.json is an OpenAPI 3.1 document of the routes (test strategy: contract)', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/v1/openapi.json' });
    expect(response.statusCode).toBe(200);
    const doc = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths).sort()).toMatchSnapshot();
  });

  it('request logs carry the path only: no query string (codes, tokens) and no client address', async () => {
    const lines: string[] = [];
    const { app, close } = await createTestApp({
      log: { ...logOptions('production'), stream: { write: (line: string) => lines.push(line) } },
    });
    closers.push(close);
    await app.inject({ method: 'GET', url: '/v1/health?code=SECRET-CODE&state=s' });
    const text = lines.join('');
    expect(text).toContain('/v1/health');
    expect(text).not.toContain('SECRET-CODE');
    expect(text).not.toContain('remoteAddress');
  });

  it('architecture §7: an unexpected error is logged without its query parameters', async () => {
    const lines: string[] = [];
    const { app, close } = await createTestApp({
      log: { ...logOptions('production'), stream: { write: (line: string) => lines.push(line) } },
    });
    closers.push(close);
    app.get('/v1/test/db', { config: { role: 'public' } }, () => {
      // Drizzle's query errors carry the bound values.
      throw new Error(
        'Failed query: select * from users where email = ?\nparams: secret@example.test',
      );
    });
    await app.inject({ method: 'GET', url: '/v1/test/db' });
    const text = lines.join('');
    expect(text).toContain('Failed query');
    expect(text).not.toContain('secret@example.test');
  });
});
