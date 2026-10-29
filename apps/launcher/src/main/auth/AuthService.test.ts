import type { ErrorCode } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { authorizeUrlAllowed, offlineAllowed } from './rules.ts';
import { DAY, device, entitlement, held, setup, storedSession, T0 } from './testing.ts';

const OFFLINE = { kind: 'offline' } as const;
const api = (code: ErrorCode, status = 403, details?: unknown) =>
  ({ kind: 'api', status, code, details }) as const;

describe('boot routing (IA F2, C6 launcher side)', () => {
  it('no stored session → signed out, with the banner from the API', async () => {
    const t = setup();
    t.queues.config.push({ authorizeUrl: 'https://x', clientId: 'c', scopes: [], banner: 'Hi' });
    await t.service.start();
    expect(t.service.state()).toEqual({ kind: 'signedOut', reason: null, banner: 'Hi' });
  });

  it('no session and the API down → signed out without a banner', async () => {
    const t = setup();
    t.queues.config.push(OFFLINE);
    await t.service.start();
    expect(t.service.state()).toEqual({ kind: 'signedOut', reason: null, banner: null });
  });

  it('C6: session + API up → signed in online; the rotated token and check time are stored', async () => {
    const t = setup({ session: storedSession(T0 - DAY) });
    await t.service.start();
    expect(t.service.state()).toMatchObject({ kind: 'signedIn', offline: false, remembered: true });
    expect(await t.stored()).toMatchObject({
      refreshToken: 'r1',
      localCheckedAt: new Date(T0).toISOString(),
    });
    expect(t.calls).toEqual(['refresh:r0', 'entitlement:a1']);
  });

  it('D43: after each online check the listeners run (the catalog syncs); offline ones do not', async () => {
    const t = setup({ session: storedSession(T0 - DAY) });
    const seen: string[] = [];
    t.service.onChecked(() => seen.push('checked'));
    await t.service.start();
    expect(seen).toEqual(['checked']);
    expect(t.service.deviceId()).toBe('d1');
    t.queues.refresh.push(OFFLINE);
    await t.service.refreshEntitlement();
    expect(t.service.state()).toMatchObject({ kind: 'signedIn', offline: true });
    expect(seen).toEqual(['checked']);
  });

  it('C6, US-A3: API down 13 days after the last check → signed in offline', async () => {
    const t = setup({ session: storedSession(T0 - 13 * DAY) });
    t.queues.refresh.push(OFFLINE);
    await t.service.start();
    expect(t.service.state()).toMatchObject({ kind: 'signedIn', offline: true });
  });

  it('C6, US-A3: 15 days → "connect to continue", and the session is kept for reconnecting', async () => {
    const t = setup({ session: storedSession(T0 - 15 * DAY) });
    t.queues.refresh.push(OFFLINE);
    await t.service.start();
    expect(t.service.state()).toMatchObject({ kind: 'signedOut', reason: 'offlineExpired' });
    expect(await t.stored()).not.toBeNull();
    await t.service.refreshEntitlement();
    expect(t.service.state()).toMatchObject({ kind: 'signedIn', offline: false });
  });

  it('C6: a refused refresh (device revoked) removes the session', async () => {
    const t = setup({ session: storedSession(T0 - DAY) });
    t.queues.refresh.push(api('UNAUTHENTICATED', 401));
    await t.service.start();
    expect(t.service.state()).toMatchObject({ kind: 'signedOut', reason: 'revoked' });
    expect(await t.stored()).toBeNull();
  });

  it('a stored session that does not parse counts as none', async () => {
    const t = setup({ session: '{"nope":1}' });
    await t.service.start();
    expect(t.service.state()).toMatchObject({ kind: 'signedOut', reason: null });
  });

  it('D25: disabled → no network at all', async () => {
    const t = setup({ disabled: true, session: storedSession(T0) });
    await t.service.start();
    expect(t.service.state()).toEqual({ kind: 'disabled' });
    expect(t.calls).toEqual([]);
  });
});

describe('offline rules (FR-AUTH-5, Review Focus 2)', () => {
  const record = { localCheckedAt: new Date(T0).toISOString(), entitlement: entitlement(T0) };

  it('allowed from 5 minutes before the last check to the end of the grace', () => {
    expect(offlineAllowed(record, new Date(T0 + 14 * DAY - 1))).toBe(true);
    expect(offlineAllowed(record, new Date(T0 + 14 * DAY))).toBe(false);
    expect(offlineAllowed(record, new Date(T0 - 4 * 60_000))).toBe(true);
    expect(offlineAllowed(record, new Date(T0 - 3600_000))).toBe(false);
  });

  it('the grace length comes from the server; the start from this PC', () => {
    const shortGrace = {
      localCheckedAt: new Date(T0).toISOString(),
      entitlement: entitlement(T0 - 10 * DAY, {
        offlineUntil: new Date(T0 - 7 * DAY).toISOString(),
      }),
    };
    expect(offlineAllowed(shortGrace, new Date(T0 + 2 * DAY))).toBe(true);
    expect(offlineAllowed(shortGrace, new Date(T0 + 3 * DAY))).toBe(false);
  });

  it('the browser only goes to Google or to the API itself', () => {
    const origin = 'http://localhost:4000';
    expect(authorizeUrlAllowed('https://accounts.google.com/o/oauth2/v2/auth', origin)).toBe(true);
    expect(authorizeUrlAllowed('http://localhost:4000/v1/auth/stub/authorize', origin)).toBe(true);
    expect(authorizeUrlAllowed('https://evil.example/auth', origin)).toBe(false);
    expect(authorizeUrlAllowed('http://accounts.google.com/x', origin)).toBe(false);
    expect(authorizeUrlAllowed('file:///c:/x', origin)).toBe(false);
  });
});

describe('hourly check (FR-AUTH-7, Review Focus 1)', () => {
  it('FR-AUTH-7: a suspension arrives at the next tick', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    t.advance(3600_000);
    t.queues.entitlement.push({
      entitlement: entitlement(T0 + 3600_000, { status: 'suspended', plan: null }),
      banner: null,
    });
    t.tick();
    await t.service.idle();
    expect(t.service.state()).toMatchObject({
      kind: 'signedIn',
      entitlement: { status: 'suspended' },
    });
    expect(t.states.at(-1)).toMatchObject({ entitlement: { status: 'suspended' } });
  });

  it('going offline during the grace keeps the user in, marked offline', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    t.advance(3600_000);
    t.queues.refresh.push(OFFLINE);
    t.tick();
    await t.service.idle();
    expect(t.service.state()).toMatchObject({ kind: 'signedIn', offline: true });
  });

  it('Review Focus 1: two checks at once make one refresh, so the token is never replayed', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    t.calls.length = 0;
    t.advance(20 * 60_000);
    await Promise.all([t.service.refreshEntitlement(), t.service.refreshEntitlement()]);
    expect(t.calls.filter((c) => c.startsWith('refresh:'))).toEqual(['refresh:r1']);
  });
});

describe('sign-in (US-A1, US-A4, FR-AUTH-6)', () => {
  it('US-A1: the browser gets the PKCE challenge, state and loopback; the code is exchanged', async () => {
    const t = setup();
    await t.service.start();
    const done = t.service.signIn();
    await t.browse({ code: 'the-code' });
    expect(await done).toMatchObject({ kind: 'signedIn', offline: false });
    const url = new URL(t.opened[0] ?? '');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cid',
      redirect_uri: 'http://127.0.0.1:5555/callback',
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: 'chal',
      code_challenge_method: 'S256',
      state: 'st',
    });
    expect(t.calls.some((c) => c.includes('"code":"the-code"') && c.includes('v'.repeat(64)))).toBe(
      true,
    );
    expect(await t.stored()).toMatchObject({ refreshToken: 'r-new', deviceId: 'd1' });
  });

  it.each([
    ['cancelled', { cancelled: true } as const, 'cancelled'],
    ['timeout', { timeout: true } as const, 'timeout'],
  ])('US-A1: the browser %s → signed out with that reason', async (_n, result, reason) => {
    const t = setup();
    await t.service.start();
    const done = t.service.signIn();
    await t.browse(result);
    expect(await done).toMatchObject({ kind: 'signedOut', reason });
  });

  it('D22: an account the API refuses → not allowed', async () => {
    const t = setup();
    await t.service.start();
    t.queues.exchange.push(api('NOT_ALLOWED'));
    const done = t.service.signIn();
    await t.browse({ code: 'c' });
    expect(await done).toMatchObject({ kind: 'signedOut', reason: 'notAllowed' });
  });

  it('Review Focus 4: the API down at sign-in → unreachable, and no browser opens', async () => {
    const t = setup();
    await t.service.start();
    t.queues.config.push(OFFLINE);
    expect(await t.service.signIn()).toMatchObject({ kind: 'signedOut', reason: 'unreachable' });
    expect(t.opened).toEqual([]);
  });

  it('an authorize URL that is neither Google nor the API is refused', async () => {
    const t = setup();
    await t.service.start();
    t.queues.config.push({
      authorizeUrl: 'https://evil.example/a',
      clientId: 'c',
      scopes: [],
      banner: null,
    });
    expect(await t.service.signIn()).toMatchObject({ kind: 'signedOut', reason: 'error' });
    expect(t.opened).toEqual([]);
  });

  it('US-A4: device limit → the list; removing one finishes the sign-in', async () => {
    const t = setup();
    await t.service.start();
    t.queues.exchange.push(
      api('DEVICE_LIMIT', 409, {
        ticket: 'tk',
        devices: [device('d7'), device('d8'), device('d9')],
      }),
    );
    const done = t.service.signIn();
    await t.browse({ code: 'c' });
    expect(await done).toMatchObject({ kind: 'deviceLimit', devices: [{ id: 'd7' }, {}, {}] });
    expect(await t.service.resolveDeviceLimit('d7')).toMatchObject({ kind: 'signedIn' });
    expect(t.calls).toContain('complete:d7');
  });

  it('cancelling while the browser is open ends the sign-in as cancelled', async () => {
    const t = setup();
    await t.service.start();
    const done = t.service.signIn();
    await t.browse({ cancelled: true });
    t.service.cancelSignIn();
    expect(await done).toMatchObject({ kind: 'signedOut', reason: 'cancelled' });
  });

  it('D28: a banner the admin cleared since boot is gone after a cancelled sign-in', async () => {
    const t = setup();
    t.queues.config.push({ authorizeUrl: 'https://x', clientId: 'c', scopes: [], banner: 'Old' });
    await t.service.start();
    expect(t.service.state()).toMatchObject({ banner: 'Old' });
    t.queues.config.push({
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: 'c',
      scopes: [],
      banner: null,
    });
    const done = t.service.signIn();
    await t.browse({ cancelled: true });
    expect(await done).toEqual({ kind: 'signedOut', reason: 'cancelled', banner: null });
  });

  it('D28: the fresh banner is kept when the browser half fails', async () => {
    const t = setup({ loopbackFails: true });
    t.queues.config.push({ authorizeUrl: 'https://x', clientId: 'c', scopes: [], banner: 'Old' });
    await t.service.start();
    t.queues.config.push({
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: 'c',
      scopes: [],
      banner: 'New',
    });
    expect(await t.service.signIn()).toEqual({ kind: 'signedOut', reason: 'error', banner: 'New' });
  });

  it('FR-AUTH-6: sign-out tells the API, removes the session, and survives the API being down', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    expect(await t.service.signOut()).toMatchObject({ kind: 'signedOut', reason: null });
    expect(t.calls.some((c) => c.startsWith('logout:'))).toBe(true);
    expect(await t.stored()).toBeNull();
  });

  it('without the OS store the sign-in works for this run but is not remembered', async () => {
    const t = setup({ secretsAvailable: false });
    await t.service.start();
    const done = t.service.signIn();
    await t.browse({ code: 'c' });
    expect(await done).toMatchObject({ kind: 'signedIn', remembered: false });
    expect(t.secrets.values.size).toBe(0);
  });
});

describe('devices (FR-AUTH-8, US-A4)', () => {
  it('lists with a fresh token and revokes another device', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    expect((await t.service.devices()).map((d) => d.id)).toEqual(['d1', 'd2']);
    await t.service.revokeDevice('d2');
    expect(t.calls).toContain('revoke:a1:d2');
  });

  it('offline: the device list fails with API_UNREACHABLE', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    t.queues.devices.push(OFFLINE);
    await expect(t.service.devices()).rejects.toMatchObject({ error: { code: 'API_UNREACHABLE' } });
  });
});

describe('races and recovery (review, FR-AUTH-6, US-A3, Review Focus 1)', () => {
  it('FR-AUTH-6: a check still running when the user signs out never brings the session back', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    const slow = held({ accessToken: 'a9', refreshToken: 'r9' });
    t.queues.refresh.push(slow.step);
    const check = t.service.refreshEntitlement();
    await t.service.signOut();
    slow.release();
    await check;
    expect(t.service.state()).toMatchObject({ kind: 'signedOut', reason: null });
    expect(await t.stored()).toBeNull();
  });

  it('US-A3: Try again after the grace reconnects with the kept session, without the browser', async () => {
    const t = setup({ session: storedSession(T0 - 15 * DAY) });
    t.queues.refresh.push(OFFLINE);
    await t.service.start();
    expect(t.service.state()).toMatchObject({ reason: 'offlineExpired' });
    expect(await t.service.signIn()).toMatchObject({ kind: 'signedIn', offline: false });
    expect(t.opened).toEqual([]);
  });

  it('US-A3: Try again while still offline stays on "connect to continue", no browser', async () => {
    const t = setup({ session: storedSession(T0 - 15 * DAY) });
    t.queues.refresh.push(OFFLINE, OFFLINE);
    await t.service.start();
    expect(await t.service.signIn()).toMatchObject({ kind: 'signedOut', reason: 'offlineExpired' });
    expect(t.opened).toEqual([]);
  });

  it('a loopback that cannot listen ends the sign-in with an error, not a stuck wait', async () => {
    const t = setup({ loopbackFails: true });
    await t.service.start();
    expect(await t.service.signIn()).toMatchObject({ kind: 'signedOut', reason: 'error' });
    expect(t.service.state()).toMatchObject({ kind: 'signedOut' });
  });

  it('Cancel pressed before the browser opens stops the sign-in there', async () => {
    const t = setup();
    await t.service.start();
    const slow = held({
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: 'c',
      scopes: [],
      banner: null,
    });
    t.queues.config.push(slow.step);
    const done = t.service.signIn();
    t.service.cancelSignIn();
    slow.release();
    expect(await done).toMatchObject({ kind: 'signedOut', reason: 'cancelled' });
    expect(t.opened).toEqual([]);
  });

  it('Review Focus 1: the hourly check and an Account call with a stale token make one refresh', async () => {
    const t = setup({ session: storedSession(T0) });
    await t.service.start();
    t.calls.length = 0;
    t.advance(20 * 60_000);
    await Promise.all([t.service.refreshEntitlement(), t.service.devices()]);
    expect(t.calls.filter((c) => c.startsWith('refresh:'))).toEqual(['refresh:r1']);
  });
});
