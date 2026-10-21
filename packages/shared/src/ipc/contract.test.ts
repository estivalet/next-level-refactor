import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../errors.ts';
import en from '../i18n/en.json';
import { ipcContract } from './contract.ts';

function lookup(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[key]
          : undefined,
      en,
    );
}

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

describe('error messages', () => {
  it('every error code message key exists in en.json', () => {
    for (const key of Object.values(ERROR_CODES)) {
      const message = lookup(key);
      expect(typeof message === 'string' && message.length > 0, key).toBe(true);
    }
  });
});

describe('app.quit', () => {
  it('FR-SHELL-5: takes no input', () => {
    const channel = ipcContract['app.quit'];
    expect(channel.input.safeParse(undefined).success).toBe(true);
    expect(channel.input.safeParse({}).success).toBe(false);
  });
});

describe('settings channels', () => {
  it('FR-SET-2: settings.save rejects unknown keys', () => {
    const input = ipcContract['settings.save'].input;
    expect(input.safeParse({ settings: { schemaVersion: 1 }, baseRevision: 0 }).success).toBe(true);
    expect(
      input.safeParse({ settings: { schemaVersion: 1 }, baseRevision: 0, extra: 1 }).success,
    ).toBe(false);
  });

  it('FR-SET-7: app.openPath only accepts known folder keys', () => {
    const input = ipcContract['app.openPath'].input;
    expect(input.safeParse({ key: 'logs' }).success).toBe(true);
    expect(input.safeParse({ key: '../etc' }).success).toBe(false);
  });
});

describe('catalog and folder channels', () => {
  it('FR-LIB-1: app.pickFolder takes an optional title only', () => {
    const input = ipcContract['app.pickFolder'].input;
    expect(input.safeParse({}).success).toBe(true);
    expect(input.safeParse({ title: 'Pick' }).success).toBe(true);
    expect(input.safeParse({ path: 'C:/' }).success).toBe(false);
    expect(ipcContract['app.pickFolder'].output.safeParse(null).success).toBe(true);
  });

  it('FR-EMU-1: systems.catalog returns system definitions', () => {
    expect(ipcContract['systems.catalog'].output.safeParse([]).success).toBe(true);
  });
});
