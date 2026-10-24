import { defaultSettings, type ImportItem, type ImportReport } from '@nextlevel/shared';
import { emulatorPresets, systemCatalog } from '@nextlevel/system-catalog';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectEmulators } from '../launch/detect.ts';
import { inProcessWalker } from '../scan/walker.ts';
import { dryRun, type ExistingImports, type ImportDeps } from './dryRun.ts';
import { LEGACY_FIXTURE, legacyCopy, type LegacyCopy } from './testing.ts';

const copies: LegacyCopy[] = [];
afterEach(async () => {
  await Promise.all(copies.splice(0).map((c) => c.cleanup()));
});

async function setup(existing: ExistingImports = { collections: [], menuSources: [] }) {
  const copy = await legacyCopy();
  copies.push(copy);
  const settings = defaultSettings();
  let n = 0;
  const deps: ImportDeps = {
    catalog: systemCatalog(),
    presets: emulatorPresets(),
    settings: () => settings,
    newId: () => `01900000-0000-7000-8000-${String(++n).padStart(12, '0')}`,
    detect: (folder) => detectEmulators(folder, emulatorPresets()),
    createWalker: inProcessWalker,
    folderExists: async (dir) => {
      const { stat } = await import('node:fs/promises');
      return stat(dir).then(
        (s) => s.isDirectory(),
        () => false,
      );
    },
    existing: () => existing,
  };
  return { copy, deps, settings };
}

const project = (items: readonly ImportItem[]) =>
  items
    .map(({ area, key, reason, count }) => ({ area, key, reason, ...(count ? { count } : {}) }))
    .sort(
      (a, b) =>
        a.area.localeCompare(b.area) ||
        a.key.localeCompare(b.key) ||
        a.reason.localeCompare(b.reason),
    );

describe('dryRun', () => {
  it('FR-IMP-2, US-B3: the fixture dry run matches expected.json', async () => {
    const { copy, deps } = await setup();
    const expected = JSON.parse(
      await readFile(join(LEGACY_FIXTURE, 'expected.json'), 'utf8'),
    ) as Pick<ImportReport, 'counts' | 'systems' | 'unmapped'>;
    const report = await dryRun(copy.data, null, deps);
    expect(report.counts).toEqual(expected.counts);
    expect(report.systems).toEqual(expected.systems);
    expect(project(report.unmapped)).toEqual(project(expected.unmapped));
    expect(report.willReplace).toEqual([]);
    expect(report.source).toBe(copy.data);
    expect(report.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('FR-IMP-2: the dry run changes neither settings nor the source folder', async () => {
    const { copy, deps, settings } = await setup();
    const before = structuredClone(settings);
    const config = await readFile(join(copy.data, 'config.json'), 'utf8');
    await dryRun(copy.data, null, deps);
    expect(settings).toEqual(before);
    expect(await readFile(join(copy.data, 'config.json'), 'utf8')).toBe(config);
  });

  it('D12: imported collections and menus that exist are listed as replaced; names taken here get a suffix', async () => {
    const { copy, deps } = await setup({
      collections: [
        { name: 'Favorites Mix', source: null },
        { name: 'Party Picks', source: 'nextlevelos:Party Picks' },
      ],
      menuSources: ['nextlevelos:menu.json'],
    });
    const report = await dryRun(copy.data, null, deps);
    expect(project(report.willReplace)).toEqual([
      { area: 'collection', key: 'Party Picks', reason: 'replacesImport' },
      { area: 'menu', key: 'menu.json', reason: 'replacesImport' },
    ]);
    expect(report.unmapped.find((i) => i.reason === 'nameConflict')).toEqual({
      area: 'collection',
      key: 'Favorites Mix',
      reason: 'nameConflict',
      detail: 'Favorites Mix (NextLevelOS)',
    });
  });

  it('D12: a suffixed name that is also taken counts up; a renamed import holds its new name', async () => {
    const { copy, deps } = await setup({
      collections: [
        { name: 'Party Picks', source: null },
        { name: 'Party Picks (NextLevelOS)', source: null },
        // An imported "Lonely" renamed here to the name of another NextLevelOS gamelist.
        { name: 'Favorites Mix', source: 'nextlevelos:Lonely' },
      ],
      menuSources: [],
    });
    const report = await dryRun(copy.data, null, deps);
    const renamed = report.unmapped
      .filter((i) => i.reason === 'nameConflict')
      .map((i) => [i.key, i.detail]);
    expect(renamed).toEqual([
      ['Favorites Mix', 'Favorites Mix (NextLevelOS)'],
      ['Party Picks', 'Party Picks (NextLevelOS 2)'],
    ]);
  });

  it('D14: an emulators folder adds detected emulators and enables per-game RetroArch options', async () => {
    const { copy, deps } = await setup();
    const emulators = join(copy.root, 'emulators');
    await mkdir(join(emulators, 'RetroArch'), { recursive: true });
    await writeFile(join(emulators, 'RetroArch', 'retroarch.exe'), 'invented');
    const report = await dryRun(copy.data, emulators, deps);
    expect(report.mapped.find((i) => i.reason === 'emulatorAdded')).toMatchObject({
      key: 'RetroArch',
      detail: join(emulators, 'RetroArch', 'retroarch.exe'),
    });
    expect(report.unmapped.some((i) => i.reason === 'retroarchNotFound')).toBe(false);
    expect(report.mapped.some((i) => i.reason === 'launchOverride' && i.key === 'Arcade')).toBe(
      true,
    );
  });
});
