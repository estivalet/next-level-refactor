import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeClock, testEnv } from '../../test/testApp.ts';
import { openDb, type ApiDb } from '../db/open.ts';
import { DeviceRepository } from '../users/DeviceRepository.ts';
import { UserRepository } from '../users/UserRepository.ts';
import { jwtKeys, signAccess, signTicket, verifyAccess, verifyTicket } from './tokens.ts';
import { TokenService } from './TokenService.ts';

const DAY = 24 * 3600_000;
const DEVICE = { name: 'Den', platform: 'win32', appVersion: '0.7.0' } as const;
let dir: string;
let db: ApiDb;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nextlevel-tokens-'));
  db = openDb(join(dir, 'api.db'));
});
afterEach(async () => {
  db.$client.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function setup() {
  const clock = new FakeClock();
  const keys = jwtKeys(testEnv());
  let n = 0;
  const newId = () => `id-${String((n += 1))}`;
  const users = new UserRepository(db, newId);
  const devices = new DeviceRepository(db, newId);
  const user = users.create(
    { sub: 'g1', email: 'p@example.test', name: 'P', avatarUrl: null },
    'subscriber',
    'active',
    clock.read(),
  );
  const device = devices.create(user.id, DEVICE, clock.read());
  const service = new TokenService({ db, keys, clock: clock.read, newId });
  return { clock, keys, service, user, device, devices };
}

describe('refresh tokens (ADR-006, C7)', () => {
  it('C7: rotation returns a new pair and the old refresh token stops working', async () => {
    const { service, device } = setup();
    const first = await service.issue(device.id);
    const second = await service.rotate(first.refreshToken, device.id);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.rotate(first.refreshToken, device.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('C7: presenting a replaced token revokes the device and its newest token', async () => {
    const { service, device, devices } = setup();
    const first = await service.issue(device.id);
    const second = await service.rotate(first.refreshToken, device.id);
    await expect(service.rotate(first.refreshToken, device.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(devices.byId(device.id)?.revokedAt).not.toBeNull();
    await expect(service.rotate(second.refreshToken, device.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('a refresh token expires after 30 days', async () => {
    const { service, device, clock } = setup();
    const pair = await service.issue(device.id);
    clock.advance(30 * DAY + 1000);
    await expect(service.rotate(pair.refreshToken, device.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it("another device's id, a revoked device and an unknown token are refused", async () => {
    const { service, device, devices, user, clock } = setup();
    const other = devices.create(user.id, DEVICE, clock.read());
    const pair = await service.issue(device.id);
    await expect(service.rotate(pair.refreshToken, other.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(service.rotate('nope', device.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const kept = await service.issue(other.id);
    service.revokeDevice(other.id);
    await expect(service.rotate(kept.refreshToken, other.id)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('only the SHA-256 of a refresh token is stored', async () => {
    const { service, device } = setup();
    const pair = await service.issue(device.id);
    const stored = db.$client.prepare('select token_hash from refresh_tokens').pluck().all();
    expect(stored).not.toContain(pair.refreshToken);
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('refresh-token pruning (M7 minor)', () => {
  const tokensOf = (deviceId: string) =>
    db.$client
      .prepare('select count(*) from refresh_tokens where device_id = ?')
      .pluck()
      .get(deviceId);

  it('a sign-in deletes tokens expired over a day ago, keeping rotated ones until they expire', async () => {
    const { service, device, devices, user, clock } = setup();
    const first = await service.issue(device.id);
    await service.rotate(first.refreshToken, device.id);
    expect(tokensOf(device.id)).toBe(2);
    clock.advance(10 * DAY);
    await service.issue(devices.create(user.id, DEVICE, clock.read()).id);
    // The replaced token stays: presenting it again must still count as reuse.
    expect(tokensOf(device.id)).toBe(2);
    clock.advance(22 * DAY);
    await service.issue(devices.create(user.id, DEVICE, clock.read()).id);
    expect(tokensOf(device.id)).toBe(0);
  });

  it("a sign-in deletes a revoked device's tokens a day after the revoke", async () => {
    const { service, device, devices, user, clock } = setup();
    await service.issue(device.id);
    service.revokeDevice(device.id);
    clock.advance(DAY / 2);
    await service.issue(devices.create(user.id, DEVICE, clock.read()).id);
    expect(tokensOf(device.id)).toBe(1);
    clock.advance(DAY);
    await service.issue(devices.create(user.id, DEVICE, clock.read()).id);
    expect(tokensOf(device.id)).toBe(0);
  });
});

describe('access tokens and tickets (ADR-006, security §2)', () => {
  const claims = { sub: 'u1', did: 'd1', role: 'subscriber' as const };

  it('an access token lasts 15 minutes', async () => {
    const keys = jwtKeys(testEnv());
    const now = new Date('2026-10-25T12:00:00.000Z');
    const token = await signAccess(claims, keys, now);
    expect(await verifyAccess(token, keys, new Date(now.getTime() + 14 * 60_000))).toEqual(claims);
    await expect(
      verifyAccess(token, keys, new Date(now.getTime() + 15 * 60_000 + 1000)),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('a token signed with the previous secret still verifies; an unknown key does not', async () => {
    const now = new Date('2026-10-25T12:00:00.000Z');
    const oldSecret = Buffer.alloc(32, 1).toString('base64');
    const before = jwtKeys(testEnv({ JWT_SECRET: oldSecret }));
    const token = await signAccess(claims, before, now);
    const rotated = jwtKeys(testEnv({ JWT_SECRET_PREVIOUS: oldSecret }));
    expect(await verifyAccess(token, rotated, now)).toEqual(claims);
    const unrelated = jwtKeys(testEnv({ JWT_SECRET: Buffer.alloc(32, 9).toString('base64') }));
    await expect(verifyAccess(token, unrelated, now)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('a device-limit ticket is not an access token and lasts 5 minutes', async () => {
    const keys = jwtKeys(testEnv());
    const now = new Date('2026-10-25T12:00:00.000Z');
    const ticket = await signTicket({ sub: 'u1', device: DEVICE }, keys, now);
    await expect(verifyAccess(ticket, keys, now)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(await verifyTicket(ticket, keys, now)).toMatchObject({ sub: 'u1', device: DEVICE });
    await expect(
      verifyTicket(ticket, keys, new Date(now.getTime() + 5 * 60_000 + 1000)),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const access = await signAccess(claims, keys, now);
    await expect(verifyTicket(access, keys, now)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
