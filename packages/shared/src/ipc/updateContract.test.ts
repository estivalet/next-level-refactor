import { describe, expect, it } from 'vitest';
import { UpdateStateSchema } from './updateContract.ts';

describe('update contract (NFR-UPD-1, D53)', () => {
  it('accepts every state the About page shows', () => {
    for (const state of [
      { kind: 'unsupported', reason: 'dev', availableVersion: null, releaseUrl: null },
      {
        kind: 'unsupported',
        reason: 'zip',
        availableVersion: '1.0.1',
        releaseUrl: 'https://github.com/estivalet/next-level-refactor/releases/tag/v1.0.1',
      },
      { kind: 'idle', lastCheck: null },
      { kind: 'idle', lastCheck: '2026-11-13T10:00:00.000Z' },
      { kind: 'checking' },
      { kind: 'downloading', version: '1.0.1', percent: 42 },
      { kind: 'ready', version: '1.0.1' },
      { kind: 'error', code: 'network' },
    ]) {
      expect(UpdateStateSchema.parse(state)).toEqual(state);
    }
  });

  it('rejects a percent outside 0–100 and an unknown error code', () => {
    expect(
      UpdateStateSchema.safeParse({ kind: 'downloading', version: '1.0.1', percent: 101 }).success,
    ).toBe(false);
    expect(UpdateStateSchema.safeParse({ kind: 'error', code: 'disk' }).success).toBe(false);
  });
});
