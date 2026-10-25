import { defaultSettings, type Settings } from '@nextlevel/shared';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planScan } from './plan.ts';
import { system } from './testing.ts';

const LOC_A = '0192b2a0-0000-7000-8000-000000000001';
const LOC_B = '0192b2a0-0000-7000-8000-000000000002';

function settings(systems: Settings['systems']): Settings {
  return {
    ...defaultSettings(),
    storage: {
      ...defaultSettings().storage,
      locations: [
        { id: LOC_A, name: 'A', path: 'E:\\roms', priority: 1 },
        { id: LOC_B, name: 'B', path: 'F:\\more', priority: 2 },
      ],
    },
    systems,
  };
}

const catalog = [
  system('enabled-one', { defaultFolderName: 'Enabled One', extensions: ['z64'] }),
  system('untouched-here', { defaultFolderName: 'Here' }),
  system('untouched-absent', { defaultFolderName: 'Absent' }),
  system('switched-off', { defaultFolderName: 'Off' }),
];
const existing = new Set([join('F:\\more', 'Here'), join('E:\\roms', 'Off')]);
const folderExists = (dir: string) => Promise.resolve(existing.has(dir));

describe('planScan', () => {
  it('FR-LIB-3: scan all covers enabled systems and untouched systems whose folder exists', async () => {
    const jobs = await planScan(
      settings({
        'enabled-one': { enabled: true, folderName: 'N64', extensions: ['n64'] },
        'switched-off': { enabled: false },
      }),
      catalog,
      undefined,
      folderExists,
    );
    expect(jobs).toEqual([
      {
        systemId: 'enabled-one',
        dirs: [
          { locationId: LOC_A, dir: join('E:\\roms', 'N64') },
          { locationId: LOC_B, dir: join('F:\\more', 'N64') },
        ],
        extensions: ['n64'],
      },
      {
        systemId: 'untouched-here',
        dirs: [
          { locationId: LOC_A, dir: join('E:\\roms', 'Here') },
          { locationId: LOC_B, dir: join('F:\\more', 'Here') },
        ],
        extensions: ['zip'],
      },
    ]);
  });

  it('FR-LIB-3: explicit ids scan exactly those systems, even switched off', async () => {
    const jobs = await planScan(
      settings({ 'switched-off': { enabled: false } }),
      catalog,
      ['switched-off'],
      folderExists,
    );
    expect(jobs.map((job) => job.systemId)).toEqual(['switched-off']);
  });

  it('FR-LIB-3: an unknown explicit system id is rejected', async () => {
    await expect(planScan(settings({}), catalog, ['nope'], folderExists)).rejects.toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { unknownSystemIds: ['nope'] } },
    });
  });
});

describe('planScan media location (FR-SCR-4)', () => {
  it('central mode: each job names <central>/<systemId>; per-ROM mode names none', async () => {
    const central = settings({ 'enabled-one': { enabled: true } });
    central.storage.media = { mode: 'central', path: join('G:', 'art') };
    const [job] = await planScan(central, catalog, ['enabled-one'], folderExists);
    expect(job?.centralMediaDir).toBe(join('G:', 'art', 'enabled-one'));
    const [perRom] = await planScan(settings({}), catalog, ['enabled-one'], folderExists);
    expect(perRom?.centralMediaDir).toBeUndefined();
  });
});
