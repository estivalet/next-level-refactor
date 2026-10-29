import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb, type ApiDb } from '../db/open.ts';
import { plans, subscriptions, users } from '../db/schema.ts';
import { currentSubscription } from './current.ts';
import { currentSubscriptions } from './currentAll.ts';
import type { SubscriptionRow } from './SubscriptionRepository.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function freshDb(): Promise<ApiDb> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-current-'));
  const db = openDb(join(dir, 'api.db'));
  closers.push(async () => {
    db.$client.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  return db;
}

function sub(id: string, userId: string, overrides: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id,
    userId,
    planId: 'basic',
    source: 'stripe',
    status: 'active',
    interval: 'month',
    currentPeriodEnd: '2026-11-25T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    grantedBy: null,
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Users with every mix of rows: none, ended, comp over stripe, newer canceled, past due… */
const ROWS: SubscriptionRow[] = [
  sub('a1', 'ua', {}),
  sub('b1', 'ub', { status: 'canceled' }),
  sub('c1', 'uc', { source: 'comp', interval: null, currentPeriodEnd: '2026-10-20T00:00:00.000Z' }),
  sub('c2', 'uc', { status: 'past_due', createdAt: '2026-09-01T00:00:00.000Z' }),
  sub('d1', 'ud', { source: 'comp', interval: null, currentPeriodEnd: null }),
  sub('d2', 'ud', { status: 'expired', createdAt: '2026-10-10T00:00:00.000Z' }),
  sub('e1', 'ue', { createdAt: '2026-09-01T00:00:00.000Z' }),
  sub('e2', 'ue', { source: 'comp', interval: null, createdAt: '2026-10-02T00:00:00.000Z' }),
];
const USERS = ['ua', 'ub', 'uc', 'ud', 'ue', 'uf'];

async function seeded() {
  const db = await freshDb();
  db.insert(plans)
    .values({ id: 'basic', slug: 'basic', name: 'Basic', deviceLimit: 2, scopeIds: [] })
    .run();
  for (const id of USERS) {
    db.insert(users)
      .values({
        id,
        googleSub: id,
        email: `${id}@example.test`,
        name: id,
        createdAt: NOW.toISOString(),
      })
      .run();
  }
  db.insert(subscriptions).values(ROWS).run();
  return db;
}

describe('current subscriptions for many users (FR-ADM-6, D38)', () => {
  it('agrees with the single-user rule for every user of a mixed fixture', async () => {
    const db = await seeded();
    const all = currentSubscriptions(db, NOW);
    for (const user of USERS) {
      const single = currentSubscription(
        ROWS.filter((row) => row.userId === user),
        NOW,
      );
      expect(all.get(user)?.id ?? null, user).toBe(single?.id ?? null);
    }
    expect(all.has('uf')).toBe(false);
  });

  it('reads the subscriptions table once, optionally for some users only', async () => {
    const db = await seeded();
    const prepare = vi.spyOn(db.$client, 'prepare');
    const some = currentSubscriptions(db, NOW, ['ua', 'uc']);
    expect([...some.keys()].sort()).toEqual(['ua', 'uc']);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(currentSubscriptions(db, NOW, []).size).toBe(0);
  });
});
