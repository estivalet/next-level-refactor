import { describe, expect, it } from 'vitest';
import { memorySecrets } from '../secrets/testing.ts';
import { SessionVault } from './SessionVault.ts';
import { storedSession, T0 } from './testing.ts';

const log = { warn: () => undefined };
const record = () => JSON.parse(storedSession(T0)) as Parameters<SessionVault['store']>[0];

describe('SessionVault (security §2: auth.session in the OS store)', () => {
  it('loads a stored session, and reads invalid JSON as no session', async () => {
    const good = new SessionVault(memorySecrets({ 'auth.session': storedSession(T0) }), log);
    expect(await good.load()).toMatchObject({ deviceId: 'd1', refreshToken: 'r0' });
    expect(good.current()?.deviceId).toBe('d1');
    const bad = new SessionVault(memorySecrets({ 'auth.session': '{nope' }), log);
    expect(await bad.load()).toBeNull();
    expect(bad.current()).toBeNull();
  });

  it('a store failure keeps the session in memory and stops remembering it', async () => {
    const secrets = memorySecrets();
    secrets.setMany = () => Promise.reject(Object.assign(new Error('x'), { code: 'EPERM' }));
    const vault = new SessionVault(secrets, log);
    expect(vault.remembered()).toBe(true);
    await vault.store(record());
    expect(vault.current()?.refreshToken).toBe('r0');
    expect(vault.remembered()).toBe(false);
  });

  it('probe follows the OS store; clear removes the session everywhere', async () => {
    const secrets = memorySecrets({}, false);
    const vault = new SessionVault(secrets, log);
    await vault.probe();
    expect(vault.remembered()).toBe(false);
    await vault.store(record());
    expect(secrets.values.has('auth.session')).toBe(false);
    const kept = memorySecrets();
    const other = new SessionVault(kept, log);
    await other.store(record());
    expect(kept.values.has('auth.session')).toBe(true);
    await other.clear();
    expect(kept.values.has('auth.session')).toBe(false);
    expect(other.current()).toBeNull();
  });
});
