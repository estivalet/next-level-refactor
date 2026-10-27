import { AppErrorException, type AccountExport } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { exportAccountData, exportFileName } from './accountData.ts';
import { DAY, setup, storedSession, T0 } from './testing.ts';

const EXPORT: AccountExport = {
  exportedAt: new Date(T0).toISOString(),
  user: {
    id: 'u1',
    email: 'p@example.test',
    name: 'Joana Ávila',
    avatarUrl: null,
    role: 'subscriber',
    status: 'active',
    createdAt: new Date(T0).toISOString(),
    lastSeenAt: null,
  },
  devices: [],
  subscriptions: [],
  audit: [],
};

async function signedIn() {
  const t = setup({ session: storedSession(T0 - DAY) });
  await t.service.start();
  return t;
}

describe('Download my data (security §5, D36)', () => {
  it('the default file name is nextlevel-data-YYYY-MM-DD.json', () => {
    expect(exportFileName(new Date(2026, 9, 25, 12))).toBe('nextlevel-data-2026-10-25.json');
  });

  it('writes the API JSON, pretty and UTF-8, to the chosen file', async () => {
    const t = await signedIn();
    const written: Array<[string, string]> = [];
    const names: string[] = [];
    const result = await exportAccountData({
      auth: t.service,
      api: { exportData: () => Promise.resolve(EXPORT) },
      pickPath: (name) => {
        names.push(name);
        return Promise.resolve('C:\\Users\\p\\nextlevel.json');
      },
      write: (file, data) => {
        written.push([file, data]);
        return Promise.resolve();
      },
      clock: () => new Date(T0),
    });
    expect(result).toEqual({ saved: true });
    expect(names).toEqual([exportFileName(new Date(T0))]);
    expect(written).toEqual([
      ['C:\\Users\\p\\nextlevel.json', `${JSON.stringify(EXPORT, null, 2)}\n`],
    ]);
    expect(written[0]?.[1]).toContain('Joana Ávila');
  });

  it('a cancelled Save dialog writes nothing', async () => {
    const t = await signedIn();
    const written: string[] = [];
    const result = await exportAccountData({
      auth: t.service,
      api: { exportData: () => Promise.resolve(EXPORT) },
      pickPath: () => Promise.resolve(null),
      write: (file) => {
        written.push(file);
        return Promise.resolve();
      },
      clock: () => new Date(T0),
    });
    expect(result).toEqual({ saved: false });
    expect(written).toEqual([]);
  });
});

describe('Delete account from the launcher (D36)', () => {
  it('signs out with "deleted" and removes the stored session', async () => {
    const t = await signedIn();
    const state = await t.service.deleteAccount('p@example.test');
    expect(state).toMatchObject({ kind: 'signedOut', reason: 'deleted' });
    expect(t.calls).toContain('deleteAccount:p@example.test');
    expect(await t.stored()).toBeNull();
  });

  it('BILLING_UNAVAILABLE comes back as an error and the launcher stays signed in', async () => {
    const t = await signedIn();
    t.queues.deleteAccount.push({
      kind: 'api',
      status: 503,
      code: 'BILLING_UNAVAILABLE',
      details: undefined,
    });
    const error = await t.service.deleteAccount('p@example.test').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppErrorException);
    expect((error as AppErrorException).error.code).toBe('BILLING_UNAVAILABLE');
    expect(t.service.state()).toMatchObject({ kind: 'signedIn' });
    expect(await t.stored()).not.toBeNull();
  });
});
