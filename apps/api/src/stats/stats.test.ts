import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { seedItem } from '../../test/catalogSeed.ts';
import { openDb, type ApiDb } from '../db/open.ts';
import { downloads, plans, subscriptions, users } from '../db/schema.ts';
import type { SubscriptionRow } from '../subscriptions/SubscriptionRepository.ts';
import { adminStats } from './stats.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function freshDb(): Promise<ApiDb> {
  const dir = await mkdtemp(join(tmpdir(), 'nextlevel-stats-'));
  const db = openDb(join(dir, 'api.db'));
  closers.push(async () => {
    db.$client.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  return db;
}

function user(db: ApiDb, id: string, extra: Partial<typeof users.$inferInsert> = {}) {
  db.insert(users)
    .values({
      id,
      googleSub: id,
      email: `${id}@example.test`,
      name: id,
      createdAt: '2026-10-01T00:00:00.000Z',
      ...extra,
    })
    .run();
}

let n = 0;
function sub(db: ApiDb, userId: string, extra: Partial<SubscriptionRow> = {}) {
  n += 1;
  db.insert(subscriptions)
    .values({
      id: `s${String(n)}`,
      userId,
      planId: 'basic',
      source: 'stripe',
      status: 'active',
      interval: 'month',
      currentPeriodEnd: '2026-11-20T00:00:00.000Z',
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
      ...extra,
    })
    .run();
}

/** One download request: a row per file, all with the same time (as the API writes them). */
function download(db: ApiDb, itemId: string, issuedAt: string, files = 1, userId = 'ua') {
  for (let file = 0; file < files; file += 1) {
    n += 1;
    db.insert(downloads)
      .values({
        id: `d${String(n)}`,
        userId,
        deviceId: 'dev',
        fileId: `${itemId}-f${String(file)}`,
        itemId,
        issuedAt,
        ipHash: 'h',
      })
      .run();
  }
}

async function world() {
  const db = await freshDb();
  db.insert(plans)
    .values([
      {
        id: 'basic',
        slug: 'basic',
        name: 'Basic',
        deviceLimit: 2,
        scopeIds: [],
        priceMonthlyAmount: 1990,
        priceYearlyAmount: 19900,
        currency: 'brl',
      },
      {
        id: 'pro',
        slug: 'pro',
        name: 'Pro',
        deviceLimit: 3,
        scopeIds: [],
        priceMonthlyAmount: 999,
        priceYearlyAmount: null,
        currency: 'usd',
      },
    ])
    .run();
  user(db, 'admin', { role: 'admin' });
  sub(db, 'admin');
  user(db, 'banned', { status: 'suspended' });
  sub(db, 'banned', { source: 'comp', interval: null, currentPeriodEnd: null });
  user(db, 'ua');
  sub(db, 'ua');
  user(db, 'ub');
  sub(db, 'ub', { interval: 'year' });
  user(db, 'uc');
  sub(db, 'uc', { planId: 'pro' });
  user(db, 'ud', { createdAt: '2026-10-24T00:00:00.000Z' });
  sub(db, 'ud', { status: 'past_due', currentPeriodEnd: '2026-10-22T00:00:00.000Z' });
  user(db, 'ue');
  sub(db, 'ue', { source: 'comp', interval: null, currentPeriodEnd: null });
  user(db, 'uf', { createdAt: '2026-10-25T09:00:00.000Z' });
  sub(db, 'uf', { source: 'comp', interval: null, currentPeriodEnd: '2026-10-01T00:00:00.000Z' });
  user(db, 'ug');
  sub(db, 'ug', { status: 'canceled' });
  return db;
}

describe('dashboard stats (FR-ADM-6, D38, D49)', () => {
  it('FR-ADM-6: counts paying and comp separately, excluding suspended and admins', async () => {
    const stats = adminStats(await world(), NOW);
    expect(stats.subscribers).toEqual({ paying: 4, comp: 1 });
  });

  it('MRR adds monthly amounts and yearly ÷ 12 (rounded to minor units) per currency', async () => {
    const stats = adminStats(await world(), NOW);
    // brl: 1990 (ua) + 19900 / 12 (ub) = 3648.33…; ud is past due; usd: 999 (uc).
    expect(stats.mrr).toEqual([
      { currency: 'brl', amount: 3648 },
      { currency: 'usd', amount: 999 },
    ]);
  });

  it('downloads per day are zero-filled for 30 UTC days; a request with many files counts once', async () => {
    const db = await world();
    seedItem(db, { id: 'i1' });
    download(db, 'i1', '2026-10-25T08:00:00.000Z', 2);
    download(db, 'i1', '2026-10-24T23:59:59.000Z');
    download(db, 'i1', '2026-09-26T00:00:00.000Z');
    download(db, 'i1', '2026-09-25T23:59:59.000Z');
    const stats = adminStats(db, NOW);
    expect(stats.downloadsPerDay).toHaveLength(30);
    expect(stats.downloadsPerDay[0]).toEqual({ date: '2026-09-26', count: 1 });
    expect(stats.downloadsPerDay[28]).toEqual({ date: '2026-10-24', count: 1 });
    expect(stats.downloadsPerDay[29]).toEqual({ date: '2026-10-25', count: 1 });
    expect(stats.downloadsPerDay.slice(1, 28).every((day) => day.count === 0)).toBe(true);
    expect(stats.downloads7d).toBe(2);
  });

  it('top items ranks by downloads in 30 days (ties by title), at most 10', async () => {
    const db = await world();
    for (let i = 0; i < 12; i += 1) {
      const id = `i${String(i).padStart(2, '0')}`;
      seedItem(db, { id });
      db.$client.prepare('update catalog_items set title = ? where id = ?').run(`Game ${id}`, id);
      for (let k = 0; k <= i % 4; k += 1) {
        download(db, id, `2026-10-2${String(k)}T10:00:00.000Z`);
      }
    }
    // Older than 30 days: not counted.
    for (let k = 0; k < 9; k += 1) download(db, 'i00', `2026-09-0${String(k + 1)}T10:00:00.000Z`);
    const stats = adminStats(db, NOW);
    expect(stats.topItems).toHaveLength(10);
    expect(stats.topItems.slice(0, 4)).toEqual([
      { itemId: 'i03', title: 'Game i03', downloads: 4 },
      { itemId: 'i07', title: 'Game i07', downloads: 4 },
      { itemId: 'i11', title: 'Game i11', downloads: 4 },
      { itemId: 'i02', title: 'Game i02', downloads: 3 },
    ]);
  });

  it('past-due lists Stripe past_due users; sign-ups are the 10 newest accounts', async () => {
    const db = await world();
    for (let i = 0; i < 10; i += 1)
      user(db, `old${String(i)}`, { createdAt: '2026-01-01T00:00:00.000Z' });
    const stats = adminStats(db, NOW);
    expect(stats.pastDue).toEqual([
      { userId: 'ud', email: 'ud@example.test', periodEnd: '2026-10-22T00:00:00.000Z' },
    ]);
    expect(stats.recentSignups).toHaveLength(10);
    expect(stats.recentSignups.slice(0, 2).map((u) => u.id)).toEqual(['uf', 'ud']);
  });

  it('an empty install answers zeros and empty lists', async () => {
    const stats = adminStats(await freshDb(), NOW);
    expect(stats).toMatchObject({
      subscribers: { paying: 0, comp: 0 },
      mrr: [],
      downloads7d: 0,
      topItems: [],
      recentSignups: [],
      pastDue: [],
    });
    expect(stats.downloadsPerDay.every((day) => day.count === 0)).toBe(true);
  });
});
