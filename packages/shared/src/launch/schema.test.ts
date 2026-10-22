import { describe, expect, it } from 'vitest';
import { LaunchErrorDetailsSchema } from './schema.ts';

describe('LaunchErrorDetailsSchema (US-C2)', () => {
  it('US-C2: reads the details main puts on a launch error', () => {
    const details = {
      fix: { section: 'emulators', id: 'p1' },
      path: 'E:\\emu',
      reason: 'cwdMissing',
      exitCode: 2,
      stderrTail: 'oops',
    };
    expect(LaunchErrorDetailsSchema.parse(details)).toEqual(details);
  });

  it('US-C2: a fix pointing at an unknown Settings section is refused', () => {
    expect(LaunchErrorDetailsSchema.safeParse({ fix: { section: 'nowhere' } }).success).toBe(false);
  });
});
