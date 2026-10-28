import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorException } from '@nextlevel/shared';
import { SecretStore, type Cipher } from './SecretStore.ts';

/** Reversible and recognisable, so a test can tell encrypted bytes from plain text. */
const fakeCipher = (available = true, rotated = false): Cipher & { writes: number } => {
  const cipher = {
    writes: 0,
    available: () => Promise.resolve(available),
    encrypt: (text: string) => {
      cipher.writes += 1;
      return Promise.resolve(Buffer.from(`enc:${Buffer.from(text).toString('base64')}`));
    },
    decrypt: (data: Buffer) => {
      const text = data.toString();
      if (!text.startsWith('enc:')) return Promise.reject(new Error('bad data'));
      return Promise.resolve({
        text: Buffer.from(text.slice(4), 'base64').toString(),
        reEncrypt: rotated,
      });
    },
  };
  return cipher;
};

describe('SecretStore (FR-SCR-3)', () => {
  let dir: string;
  let file: string;
  const log = { warn: vi.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'secrets-'));
    file = join(dir, 'secrets.bin');
    log.warn.mockClear();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('FR-SCR-3: stores and reads values encrypted', async () => {
    const store = new SecretStore(file, fakeCipher(), log);
    await store.setMany({ 'screenscraper.user': 'player1', 'screenscraper.password': 'hunter2' });
    expect(await store.get('screenscraper.password')).toBe('hunter2');
    const bytes = await readFile(file, 'utf8');
    expect(bytes).not.toContain('hunter2');
    expect(bytes).not.toContain('player1');
    // A fresh store (next launch) reads the same file.
    expect(await new SecretStore(file, fakeCipher(), log).get('screenscraper.user')).toBe(
      'player1',
    );
  });

  it('null removes a key and leaves the others', async () => {
    const store = new SecretStore(file, fakeCipher(), log);
    await store.setMany({ 'screenscraper.user': 'a', 'screenscraper.password': 'b' });
    await store.setMany({ 'screenscraper.password': null });
    expect(await store.has('screenscraper.password')).toBe(false);
    expect(await store.get('screenscraper.user')).toBe('a');
  });

  it('an unavailable cipher refuses to save and reads nothing', async () => {
    const store = new SecretStore(file, fakeCipher(false), log);
    const saving = store.setMany({ 'screenscraper.user': 'a' });
    await expect(saving).rejects.toBeInstanceOf(AppErrorException);
    await expect(saving).rejects.toMatchObject({ error: { code: 'SECRETS_UNAVAILABLE' } });
    expect(await store.get('screenscraper.user')).toBeNull();
    expect(await store.available()).toBe(false);
  });

  it('a corrupt secrets.bin reads as empty and logs once', async () => {
    await writeFile(file, 'garbage');
    const store = new SecretStore(file, fakeCipher(), log);
    expect(await store.get('screenscraper.user')).toBeNull();
    expect(await store.has('screenscraper.devId')).toBe(false);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('garbage');
  });

  it('a save over a corrupt file starts a fresh map', async () => {
    await writeFile(file, 'garbage');
    const store = new SecretStore(file, fakeCipher(), log);
    await store.setMany({ 'screenscraper.devId': 'dev' });
    expect(await new SecretStore(file, fakeCipher(), log).get('screenscraper.devId')).toBe('dev');
  });

  it('re-encrypts the file when the OS rotated its key', async () => {
    await new SecretStore(file, fakeCipher(), log).setMany({ 'screenscraper.user': 'a' });
    const rotated = fakeCipher(true, true);
    expect(await new SecretStore(file, rotated, log).get('screenscraper.user')).toBe('a');
    expect(rotated.writes).toBe(1);
  });

  it('FR-AUTH-6: two writes at once (scraper account, sign-in session) both persist', async () => {
    const store = new SecretStore(file, fakeCipher(), log);
    await Promise.all([
      store.setMany({ 'screenscraper.user': 'player1' }),
      store.setMany({ 'auth.session': '{"deviceId":"d"}' }),
    ]);
    const fresh = new SecretStore(file, fakeCipher(), log);
    expect(await fresh.get('screenscraper.user')).toBe('player1');
    expect(await fresh.get('auth.session')).toBe('{"deviceId":"d"}');
  });

  it('D50: undecryptable secrets (another PC or user) read as empty and log once', async () => {
    await new SecretStore(file, fakeCipher(), log).setMany({ 'auth.session': '{"token":"x"}' });
    const otherPc: Cipher = {
      available: () => Promise.resolve(true),
      encrypt: (text) => Promise.resolve(Buffer.from(text)),
      decrypt: () => Promise.reject(new Error('DPAPI: key not valid for this user')),
    };
    const store = new SecretStore(file, otherPc, log);
    expect(await store.get('auth.session')).toBeNull();
    expect(await store.get('screenscraper.user')).toBeNull();
    expect(await store.available()).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});
