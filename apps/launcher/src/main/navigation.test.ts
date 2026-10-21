import { describe, expect, it } from 'vitest';
import { externalUrlAllowed, isAllowedNavigation } from './navigation.ts';

const DEV = 'http://localhost:5173';
const INDEX = 'file:///C:/app/out/renderer/index.html';

describe('isAllowedNavigation', () => {
  it('NFR-SEC-1: allows the packaged renderer page, ignoring hash and query', () => {
    expect(isAllowedNavigation(INDEX, undefined, INDEX)).toBe(true);
    expect(isAllowedNavigation(`${INDEX}#settings?x=1`, undefined, INDEX)).toBe(true);
  });

  it('NFR-SEC-1: refuses any other local file, such as a dropped image or HTML page', () => {
    expect(isAllowedNavigation('file:///C:/Users/me/Downloads/page.html', undefined, INDEX)).toBe(
      false,
    );
    expect(isAllowedNavigation('file:///C:/app/out/renderer/other.html', undefined, INDEX)).toBe(
      false,
    );
  });

  it('NFR-SEC-1: allows the dev server origin only in development', () => {
    expect(isAllowedNavigation(`${DEV}/#x`, DEV, INDEX)).toBe(true);
    expect(isAllowedNavigation(`${DEV}/`, undefined, INDEX)).toBe(false);
  });

  it('NFR-SEC-1: refuses remote content in the app window', () => {
    expect(isAllowedNavigation('https://evil.example', DEV, INDEX)).toBe(false);
    expect(isAllowedNavigation('not a url', DEV, INDEX)).toBe(false);
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
