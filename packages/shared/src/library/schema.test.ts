import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { ScanStatusSchema } from './schema.ts';

describe('scan contract', () => {
  it('FR-LIB-3: scan.start takes optional non-empty system ids', () => {
    const input = ipcContract['scan.start'].input;
    expect(input.safeParse({}).success).toBe(true);
    expect(input.safeParse({ systemIds: ['nintendo-64'] }).success).toBe(true);
    expect(input.safeParse({ systemIds: [] }).success).toBe(false);
    expect(input.safeParse({ extra: 1 }).success).toBe(false);
  });

  it('FR-LIB-3: scan status carries progress and the last summary', () => {
    const status = {
      running: false,
      progress: null,
      last: {
        scanId: 'scan-1',
        startedAt: '2026-10-21T10:00:00.000Z',
        finishedAt: '2026-10-21T10:00:05.000Z',
        outcome: 'cancelled',
        systems: [
          { systemId: 'nintendo-64', present: 3, added: 3, moved: 0, restored: 0, missing: 0 },
        ],
        enabledSystemIds: ['nintendo-64'],
      },
    };
    expect(ScanStatusSchema.parse(status)).toEqual(status);
    expect(
      ScanStatusSchema.safeParse({ ...status, last: { ...status.last, outcome: 'x' } }).success,
    ).toBe(false);
  });

  it('FR-LIB-3: systems.list returns game counts per system', () => {
    const output = ipcContract['systems.list'].output;
    expect(
      output.safeParse([{ id: 'nintendo-64', enabled: true, games: 2, missing: 1, review: 0 }])
        .success,
    ).toBe(true);
    expect(
      output.safeParse([{ id: 'nintendo-64', enabled: true, games: -1, missing: 0 }]).success,
    ).toBe(false);
  });
});
