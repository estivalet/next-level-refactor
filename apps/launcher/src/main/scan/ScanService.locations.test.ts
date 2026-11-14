import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setupScan } from './serviceTesting.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const ARCADE = '0192b2a0-0000-7000-8000-000000000002';
const CATALOG_FOLDER = '0192b2a0-0000-7000-8000-000000000003';

describe('storage locations a scan could not find (FR-LIB-3, owner backlog 2026-11-14)', () => {
  it("FR-LIB-3: a storage location that doesn't exist is named in the scan summary", async () => {
    const gone = join('Z:\\', 'not-plugged-in', 'Roms');
    const { run } = await setupScan(cleanups, {
      moreLocations: [{ id: ARCADE, name: 'Arcade drive', path: gone, priority: 2 }],
    });
    const summary = await run();
    expect(summary.missingLocations).toEqual([{ name: 'Arcade drive', path: gone }]);
  });

  it('FR-LIB-3: the Catalog folder is never reported missing', async () => {
    const { run } = await setupScan(cleanups, {
      moreLocations: [
        {
          id: CATALOG_FOLDER,
          name: 'Catalog',
          path: join('Z:\\', 'NextLevel', 'Catalog'),
          priority: 2,
          managed: true,
        },
      ],
    });
    const summary = await run();
    expect(summary.missingLocations).toBeUndefined();
  });

  it('FR-LIB-3: a location that exists without system folders is not reported', async () => {
    const { run } = await setupScan(cleanups, {
      moreLocations: [{ id: ARCADE, name: 'Empty drive', path: tmpdir(), priority: 2 }],
    });
    const summary = await run();
    expect(summary.missingLocations).toBeUndefined();
  });
});
