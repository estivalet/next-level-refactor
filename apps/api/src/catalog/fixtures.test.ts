import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifest from '../../test/fixtures/catalog/manifest.json' with { type: 'json' };
import { CATALOG_FIXTURES } from '../../test/fixtures/catalog/make.ts';

// test-strategy §2: 5 catalog items with deterministic dummy files (no commercial ROMs).

describe('catalog fixtures (test-strategy §2)', () => {
  it('five items whose dummy files match the committed SHA-256 manifest', () => {
    expect(CATALOG_FIXTURES).toHaveLength(5);
    const files = CATALOG_FIXTURES.flatMap((item) =>
      item.files.map((file) => ({
        item: item.slug,
        filename: file.filename,
        size: file.bytes().length,
        sha256: createHash('sha256').update(file.bytes()).digest('hex'),
      })),
    );
    expect(files).toEqual(manifest.files);
    expect(files.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(64 * 1024);
  });

  it('every item has a license and at least one rom or disc file', () => {
    for (const item of CATALOG_FIXTURES) {
      expect(item.license.rightsHolder.length).toBeGreaterThan(0);
      expect(item.files.some((file) => file.role !== 'extra')).toBe(true);
    }
  });
});
