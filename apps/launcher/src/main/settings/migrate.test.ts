import { describe, expect, it } from 'vitest';
import { migrate } from './migrate.ts';

describe('migrate', () => {
  it('passes schemaVersion 1 through', () => {
    expect(migrate({ schemaVersion: 1, a: 1 })).toEqual({
      kind: 'ok',
      value: { schemaVersion: 1, a: 1 },
    });
  });

  it('treats an object without schemaVersion as version 1', () => {
    expect(migrate({ general: {} })).toEqual({
      kind: 'ok',
      value: { schemaVersion: 1, general: {} },
    });
  });

  it('reports a file written by a newer version', () => {
    expect(migrate({ schemaVersion: 99 })).toEqual({ kind: 'newerVersion' });
  });

  it('leaves non-objects for the schema to reject', () => {
    expect(migrate(42)).toEqual({ kind: 'ok', value: 42 });
  });
});
