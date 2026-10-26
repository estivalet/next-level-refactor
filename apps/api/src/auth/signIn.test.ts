import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAppSettings, type AppSettings } from '@nextlevel/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type ApiDb } from '../db/open.ts';
import { UserRepository } from '../users/UserRepository.ts';
import type { GoogleIdentity } from './identity.ts';
import { admit } from './signIn.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const ADMINS = ['owner@example.test'];
let dir: string;
let db: ApiDb;
let users: UserRepository;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nextlevel-admit-'));
  db = openDb(join(dir, 'api.db'));
  let n = 0;
  users = new UserRepository(db, () => `u${String((n += 1))}`);
});
afterEach(async () => {
  db.$client.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

/** A Google identity (no stub flags): what real sign-ins look like. */
const google = (email: string, sub = `sub-${email}`): GoogleIdentity => ({
  sub,
  email,
  name: email,
  avatarUrl: null,
});
const run = (identity: GoogleIdentity, settings: Partial<AppSettings> = {}) =>
  admit(identity, {
    settings: { ...defaultAppSettings(), ...settings },
    adminEmails: ADMINS,
    users,
    now: NOW,
  });

describe('sign-up admission (D22, FR-AUTH-4)', () => {
  it('D22: allow-list mode admits a listed email and refuses one that is not', () => {
    // Google gives lowercased emails; the settings schema lowercases the list.
    expect(run(google('tester@example.test'), { allowList: ['tester@example.test'] }).role).toBe(
      'subscriber',
    );
    expect(() => run(google('other@example.test'), { allowList: ['tester@example.test'] })).toThrow(
      expect.objectContaining({ code: 'NOT_ALLOWED' }),
    );
  });

  it('D22: closed mode admits existing users only; open mode admits anyone', () => {
    const known = google('known@example.test');
    run(known, { signUpMode: 'open' });
    expect(run(known, { signUpMode: 'closed' }).email).toBe('known@example.test');
    expect(() => run(google('new@example.test'), { signUpMode: 'closed' })).toThrow(
      expect.objectContaining({ code: 'NOT_ALLOWED' }),
    );
    expect(run(google('anyone@example.test'), { signUpMode: 'open' }).role).toBe('subscriber');
  });

  it('FR-AUTH-4: an ADMIN_EMAILS address becomes admin on its first sign-in, in any mode', () => {
    expect(run(google('owner@example.test'), { signUpMode: 'closed' }).role).toBe('admin');
  });

  it('FR-AUTH-4: a demoted bootstrap admin stays a subscriber at the next sign-in', () => {
    const owner = run(google('owner@example.test'));
    db.$client.prepare("update users set role = 'subscriber' where id = ?").run(owner.id);
    expect(run(google('owner@example.test')).role).toBe('subscriber');
  });

  it('an admin made in the console signs in even when not on the allow-list', () => {
    const person = run(google('helper@example.test'), { signUpMode: 'open' });
    db.$client.prepare("update users set role = 'admin' where id = ?").run(person.id);
    expect(run(google('helper@example.test')).role).toBe('admin');
  });

  it('a later sign-in refreshes the profile from Google (security §5 Correction)', () => {
    run({ ...google('p@example.test', 'same'), name: 'Old' }, { signUpMode: 'open' });
    const again = run(
      { ...google('p2@example.test', 'same'), name: 'New' },
      { signUpMode: 'open' },
    );
    expect(again).toMatchObject({ email: 'p2@example.test', name: 'New' });
  });
});
