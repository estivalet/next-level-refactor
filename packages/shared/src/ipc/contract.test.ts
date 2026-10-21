import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../errors.ts';
import { ipcContract } from './contract.ts';

describe('ipcContract', () => {
  it('NFR-MAINT-1: app.version takes no input and returns a string', () => {
    const channel = ipcContract['app.version'];
    expect(channel.input.safeParse(undefined).success).toBe(true);
    expect(channel.input.safeParse({ x: 1 }).success).toBe(false);
    expect(channel.output.safeParse('0.0.0').success).toBe(true);
    expect(channel.output.safeParse(1).success).toBe(false);
  });

  it('NFR-MAINT-1: every error code has a message key under errors.', () => {
    for (const key of Object.values(ERROR_CODES)) {
      expect(key).toMatch(/^errors\.[a-zA-Z]+$/);
    }
  });
});
