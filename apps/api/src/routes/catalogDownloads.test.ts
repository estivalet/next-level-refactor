import type { DownloadGrant } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogWorld } from '../../test/catalogPlayer.ts';
import { signIn } from '../../test/launcherSignIn.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const world = await catalogWorld(test.app);
  const id = await world.publish('star-hopper');
  await world.planScopes(['homebrew-8bit']);
  const issue = (deviceId = world.player.deviceId, token?: string) =>
    world.post(`/v1/catalog/items/${id}/downloads`, { deviceId }, token);
  return { ...test, ...world, id, issue };
}

describe('download URLs (FR-CAT-6, security §2)', () => {
  it('issues one 10-minute URL per file and logs each with an ip_hash, never the IP', async () => {
    const t = await setup();
    const response = await t.issue();
    expect(response.statusCode).toBe(200);
    const grant = response.json<DownloadGrant>();
    expect(grant.files).toEqual([
      expect.objectContaining({
        filename: 'Star Hopper.nes',
        url: expect.stringMatching(
          /^http:\/\/localhost:4000\/v1\/files\/[\w-]+\.[\w-]+$/,
        ) as unknown,
        expiresAt: '2026-10-25T12:10:00.000Z',
      }),
    ]);
    const rows = t.db.$client
      .prepare('select user_id as userId, device_id as deviceId, ip_hash as ipHash from downloads')
      .all() as Array<{
      userId: string;
      deviceId: string;
      ipHash: string;
    }>;
    expect(rows).toEqual([
      {
        userId: t.player.user.id,
        deviceId: t.player.deviceId,
        ipHash: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('127.0.0.1');
  });

  it("another user's (or another device's) deviceId is FORBIDDEN", async () => {
    const t = await setup();
    const other = await signIn(t.app, 'admin', 'Admin PC');
    const response = await t.issue(other.deviceId);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('an out-of-scope item is NOT_FOUND', async () => {
    const t = await setup();
    await t.planScopes([]);
    expect((await t.issue()).json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('the 61st issue in an hour is RATE_LIMITED with Retry-After; an hour later it works', async () => {
    const t = await setup();
    for (let i = 0; i < 60; i += 1) expect((await t.issue()).statusCode, String(i)).toBe(200);
    const limited = await t.issue();
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    t.clock.advance(60 * 60 * 1000 + 1);
    // The access token expired meanwhile (15 min): the launcher refreshes; here, sign in again.
    const again = await signIn(t.app, 'subscriber');
    expect((await t.issue(again.deviceId, again.accessToken)).statusCode).toBe(200);
  });
});
