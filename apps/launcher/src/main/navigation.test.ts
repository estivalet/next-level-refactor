import { describe, expect, it } from 'vitest';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';

const DEV = 'http://localhost:5173';

describe('isAllowedNavigation', () => {
  it('NFR-SEC-1: allows the packaged app files', () => {
    expect(isAllowedNavigation('file:///C:/x/index.html', undefined)).toBe(true);
  });

  it('NFR-SEC-1: allows the dev server origin only in development', () => {
    expect(isAllowedNavigation(`${DEV}/#x`, DEV)).toBe(true);
    expect(isAllowedNavigation(`${DEV}/`, undefined)).toBe(false);
  });

  it('NFR-SEC-1: refuses remote content in the app window', () => {
    expect(isAllowedNavigation('https://evil.example', DEV)).toBe(false);
    expect(isAllowedNavigation('not a url', DEV)).toBe(false);
  });
});

describe('externalUrlAllowed', () => {
  it('NFR-SEC-1: opens https links in the system browser', () => {
    expect(externalUrlAllowed('https://screenscraper.fr')).toBe(true);
  });

  it.each(['http://x', 'file:///c:/', 'javascript:alert(1)', 'not a url'])(
    'NFR-SEC-1: refuses %s',
    (url) => {
      expect(externalUrlAllowed(url)).toBe(false);
    },
  );
});
