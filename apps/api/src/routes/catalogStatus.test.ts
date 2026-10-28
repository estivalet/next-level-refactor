import type { InstallStatus } from '@nextlevel/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogWorld } from '../../test/catalogPlayer.ts';
import { createTestApp } from '../../test/testApp.ts';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});

async function setup() {
  const test = await createTestApp();
  closers.push(test.close);
  const world = await catalogWorld(test.app);
  const status = (items: Array<{ id: string; version: number }>) =>
    world.post('/v1/catalog/status', { items });
  const stateOf = async (id: string, version = 1) =>
    (await status([{ id, version }])).json<InstallStatus>().items[0];
  return { ...test, ...world, status, stateOf };
}

describe('install status (FR-CAT-7, D42, D43)', () => {
  it('a current item is current; a bumped version is update', async () => {
    const t = await setup();
    const id = await t.publish('star-hopper', { patch: { onLapse: 'remove' } });
    await t.planScopes(['homebrew-8bit']);
    expect(await t.stateOf(id)).toEqual({ id, state: 'current', version: 1, onLapse: 'remove' });
    await t.admin.uploadFile(id, 'Star Hopper (v2).nes');
    expect(await t.stateOf(id)).toEqual({ id, state: 'update', version: 2, onLapse: 'remove' });
    expect(await t.stateOf(id, 2)).toMatchObject({ state: 'current' });
  });

  it('unpublished, license-expired, out-of-scope and unknown ids are gone, with the onLapse (unknown → keep)', async () => {
    const t = await setup();
    const unpublished = await t.publish('a-game', { patch: { onLapse: 'remove' } });
    const expired = await t.publish('b-game');
    const outside = await t.publish('c-game', {
      scopeSlug: 'homebrew-16bit',
      patch: { onLapse: 'remove' },
    });
    await t.planScopes(['homebrew-8bit']);
    await t.admin.send('POST', `${t.admin.base(unpublished)}/unpublish`);
    t.db.$client
      .prepare(
        "update licenses set expires_at = '2026-10-25T11:00:00.000Z' where id = (select license_id from catalog_items where id = ?)",
      )
      .run(expired);
    const response = await t.status([
      { id: unpublished, version: 1 },
      { id: expired, version: 1 },
      { id: outside, version: 1 },
      { id: 'no-such-item', version: 3 },
    ]);
    expect(response.json<InstallStatus>().items).toEqual([
      { id: unpublished, state: 'gone', version: null, onLapse: 'remove' },
      { id: expired, state: 'gone', version: null, onLapse: 'keep' },
      { id: outside, state: 'gone', version: null, onLapse: 'remove' },
      { id: 'no-such-item', state: 'gone', version: null, onLapse: 'keep' },
    ]);
  });

  it('5,001 items is VALIDATION_FAILED', async () => {
    const t = await setup();
    const items = Array.from({ length: 5001 }, (_, i) => ({ id: `i${String(i)}`, version: 1 }));
    expect((await t.status(items)).json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });

  it('5,000 items answer in one call', async () => {
    const t = await setup();
    const items = Array.from({ length: 5000 }, (_, i) => ({ id: `i${String(i)}`, version: 1 }));
    const response = await t.status(items);
    expect(response.statusCode).toBe(200);
    expect(response.json<InstallStatus>().items).toHaveLength(5000);
  });
});
