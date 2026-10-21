import { afterEach, describe, expect, it } from 'vitest';
import { getBridge, setBridgeForTests } from './bridge.ts';

afterEach(() => {
  setBridgeForTests(null);
});

describe('getBridge', () => {
  it('returns INTERNAL instead of throwing when the preload bridge is missing', async () => {
    const result = await getBridge().invoke('app.version');
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
  });

  it('uses the bridge set for tests', async () => {
    setBridgeForTests({ invoke: (() => Promise.resolve({ ok: true, value: '9.9.9' })) as never });
    await expect(getBridge().invoke('app.version')).resolves.toEqual({ ok: true, value: '9.9.9' });
  });
});
