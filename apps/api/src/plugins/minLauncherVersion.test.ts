import { afterEach, describe, expect, it } from 'vitest';
import { adminHeaders, adminSignIn } from '../../test/adminSignIn.ts';
import { bearer, signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  const test = await createTestApp(opts);
  closers.push(test.close);
  return test;
}

const version = (v: string) => ({ 'x-nextlevel-version': v });

describe('minimum launcher version (NFR-UPD-1, D53)', () => {
  it('device route with X-NextLevel-Version below minLauncherVersion → 426 UPDATE_REQUIRED', async () => {
    const { app } = await setup({ settings: { minLauncherVersion: '1.0.0' } });
    const session = await signIn(app, 'subscriber');
    const response = await app.inject({
      url: '/v1/me/entitlement',
      headers: { ...bearer(session.accessToken), ...version('1.0.0-beta.1') },
    });
    expect(response.statusCode).toBe(426);
    expect(response.json()).toMatchObject({
      error: { code: 'UPDATE_REQUIRED', details: { minLauncherVersion: '1.0.0' } },
    });
  });

  it('a version at or above the minimum is allowed', async () => {
    const { app } = await setup({ settings: { minLauncherVersion: '1.0.0' } });
    const session = await signIn(app, 'subscriber');
    for (const v of ['1.0.0', '1.0.1', 'v2.0.0']) {
      const response = await app.inject({
        url: '/v1/me/entitlement',
        headers: { ...bearer(session.accessToken), ...version(v) },
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it('no header or null min → allowed', async () => {
    const strict = await setup({ settings: { minLauncherVersion: '1.0.0' } });
    const a = await signIn(strict.app, 'subscriber');
    const noHeader = await strict.app.inject({
      url: '/v1/me/entitlement',
      headers: bearer(a.accessToken),
    });
    expect(noHeader.statusCode).toBe(200);
    const open = await setup();
    const b = await signIn(open.app, 'subscriber');
    const noMinimum = await open.app.inject({
      url: '/v1/me/entitlement',
      headers: { ...bearer(b.accessToken), ...version('0.1.0') },
    });
    expect(noMinimum.statusCode).toBe(200);
  });

  it('an old launcher hears UPDATE_REQUIRED before UNAUTHENTICATED (no token needed)', async () => {
    const { app } = await setup({ settings: { minLauncherVersion: '1.0.0' } });
    const response = await app.inject({ url: '/v1/me/entitlement', headers: version('0.9.0') });
    expect(response.statusCode).toBe(426);
  });

  it('health and auth start are exempt', async () => {
    const { app } = await setup({ settings: { minLauncherVersion: '1.0.0' } });
    const health = await app.inject({ url: '/v1/health', headers: version('0.1.0') });
    expect(health.statusCode).toBe(200);
    const config = await app.inject({
      url: '/v1/auth/launcher-config',
      headers: version('0.1.0'),
    });
    expect(config.statusCode).toBe(200);
  });

  it('PATCH settings minLauncherVersion must be semver and is audited', async () => {
    const { app } = await setup();
    const admin = await adminSignIn(app, 'admin');
    const bad = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { minLauncherVersion: 'one' },
    });
    expect(bad.statusCode).toBe(400);
    const saved = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { minLauncherVersion: '1.0.0' },
    });
    expect(saved.json()).toMatchObject({ minLauncherVersion: '1.0.0' });
    const cleared = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings',
      headers: adminHeaders(admin, true),
      payload: { minLauncherVersion: null },
    });
    expect(cleared.json()).toMatchObject({ minLauncherVersion: null });
    const audit = await app.inject({ url: '/v1/admin/audit', headers: adminHeaders(admin) });
    expect(audit.json()).toMatchObject({
      items: [
        { action: 'settings.update', after: { minLauncherVersion: null } },
        {
          action: 'settings.update',
          before: { minLauncherVersion: null },
          after: { minLauncherVersion: '1.0.0' },
        },
      ],
    });
  });
});
