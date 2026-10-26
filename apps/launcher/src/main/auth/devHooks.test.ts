import { describe, expect, it } from 'vitest';
import { devHooks } from './startAuth.ts';

const ALL = {
  NEXTLEVEL_AUTH: 'off',
  NEXTLEVEL_API_URL: 'http://127.0.0.1:9999',
  NEXTLEVEL_E2E_BROWSER: 'stub:admin',
  NEXTLEVEL_E2E_CLOCK_OFFSET_DAYS: '15',
};

describe('development-only sign-in hooks (D25, security §3)', () => {
  it('a packaged build ignores every hook: gated, real browser, real clock, built-in API', () => {
    expect(devHooks(true, ALL)).toEqual({
      disabled: false,
      apiOverride: undefined,
      stubPersona: null,
      clockOffsetMs: 0,
    });
  });

  it('a development build honours them', () => {
    expect(devHooks(false, ALL)).toEqual({
      disabled: true,
      apiOverride: 'http://127.0.0.1:9999',
      stubPersona: 'admin',
      clockOffsetMs: 15 * 24 * 3600_000,
    });
  });

  it('nonsense values change nothing', () => {
    expect(
      devHooks(false, { NEXTLEVEL_E2E_BROWSER: 'chrome', NEXTLEVEL_E2E_CLOCK_OFFSET_DAYS: 'x' }),
    ).toMatchObject({ stubPersona: null, clockOffsetMs: 0, disabled: false });
  });
});
