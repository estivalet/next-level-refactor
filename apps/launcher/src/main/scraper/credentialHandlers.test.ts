import { describe, expect, it } from 'vitest';
import { ipcContract } from '@nextlevel/shared';
import { memorySecrets } from '../secrets/testing.ts';
import { createCredentialHandlers } from './credentialHandlers.ts';

describe('scraper credential channels (FR-SCR-3, US-D6)', () => {
  it('status reports which credentials are set, never their values', async () => {
    const store = memorySecrets();
    store.values.set('screenscraper.devId', 'dev-secret');
    const handlers = createCredentialHandlers({ secrets: store });
    const status = await handlers['scraper.credentials.status']();
    expect(status).toEqual({
      available: true,
      devId: true,
      devPassword: false,
      user: false,
      password: false,
    });
    expect(JSON.stringify(status)).not.toContain('dev-secret');
  });

  it('set changes only the given keys; null removes one', async () => {
    const store = memorySecrets();
    store.values.set('screenscraper.user', 'old');
    store.values.set('screenscraper.devId', 'dev');
    const handlers = createCredentialHandlers({ secrets: store });
    const status = await handlers['scraper.credentials.set']({
      user: 'player1',
      password: 'pw',
      devId: null,
    });
    expect(store.values.get('screenscraper.user')).toBe('player1');
    expect(store.values.get('screenscraper.password')).toBe('pw');
    expect(store.values.has('screenscraper.devId')).toBe(false);
    expect(status).toMatchObject({ user: true, password: true, devId: false });
  });

  it('the contract refuses empty, over-long and unknown values', () => {
    const input = ipcContract['scraper.credentials.set'].input;
    expect(input.safeParse({ user: '' }).success).toBe(false);
    expect(input.safeParse({ password: 'x'.repeat(201) }).success).toBe(false);
    expect(input.safeParse({ user: 'a', devPassword: null }).success).toBe(true);
    expect(input.safeParse({ other: 'a' }).success).toBe(false);
  });
});
