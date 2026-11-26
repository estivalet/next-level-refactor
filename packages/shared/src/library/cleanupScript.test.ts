import { describe, expect, it } from 'vitest';
import { ipcContract } from '../ipc/contract.ts';
import { CleanupScriptRequestSchema, CleanupScriptResultSchema } from './cleanupScript.ts';

const scope = { kind: 'system', systemId: 'gamegear' } as const;

describe('cleanup script contract', () => {
  it('FR-LIB-20: CleanupScriptRequest takes a scope and a title', () => {
    const base = { scope, title: 'Sega Game Gear' };
    expect(CleanupScriptRequestSchema.safeParse(base).success).toBe(true);
    expect(CleanupScriptRequestSchema.safeParse({ ...base, title: '' }).success).toBe(false);
    expect(CleanupScriptRequestSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it('FR-LIB-20: CleanupScriptResult is cancelled or saved with counts', () => {
    expect(CleanupScriptResultSchema.safeParse({ status: 'cancelled' }).success).toBe(true);
    expect(
      CleanupScriptResultSchema.safeParse({ status: 'saved', games: 2, files: 3 }).success,
    ).toBe(true);
    expect(
      CleanupScriptResultSchema.safeParse({ status: 'saved', games: 2, files: -1 }).success,
    ).toBe(false);
  });

  it('FR-LIB-20: the IPC contract has library.exportCleanupScript', () => {
    expect(ipcContract['library.exportCleanupScript'].input).toBe(CleanupScriptRequestSchema);
  });
});
