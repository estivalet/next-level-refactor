import { chmod, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectionLaunchers, readLegacy, runnerSystem } from './readLegacy.ts';
import { legacyCopy, type LegacyCopy } from './testing.ts';

async function filesBelow(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
}

async function snapshot(dir: string): Promise<string[]> {
  const files = await filesBelow(dir);
  return Promise.all(
    files.sort().map(async (file) => {
      const info = await stat(file);
      return `${file}|${String(info.size)}|${String(info.mtimeMs)}`;
    }),
  );
}

const readOnly: string[] = [];
const copies: LegacyCopy[] = [];
const copy = async () => {
  const made = await legacyCopy();
  copies.push(made);
  return made;
};
afterEach(async () => {
  await Promise.all(readOnly.splice(0).map((file) => chmod(file, 0o666)));
  await Promise.all(copies.splice(0).map((made) => made.cleanup()));
});

describe('readLegacy', () => {
  it('FR-IMP-1: reads settings, menus and gamelists, reporting files it cannot use', async () => {
    const { data } = await copy();
    const { files, problems } = await readLegacy(data);
    expect(files.config?.storage).toHaveLength(3);
    expect(Object.keys(files.launchers)).toHaveLength(10);
    expect(files.menus.map((m) => m.file)).toEqual(['menu-arcade.json', 'menu.json']);
    expect(files.gamelists.map((g) => g.name)).toEqual([
      'Amstrad Gx4000',
      'Arcade',
      'Atari 2600',
      'Favorites Mix',
      'Flash Games',
      'Imaginary Console',
      'Microsoft MSX',
      'Nintendo 64',
      'Nintendo NES',
      'Party Picks',
      'Sony Playstation',
    ]);
    expect(files.themes?.activeDefault).toBe('hyperspin');
    expect(files.screenscraper).toMatchObject({ 'Nintendo 64': 999 });
    expect(problems).toEqual([
      { area: 'game', key: 'gamelists/Broken.json', reason: 'invalidFile' },
      {
        area: 'game',
        key: 'gamelists/Sony Playstation_metadata_report.json',
        reason: 'notAGamelist',
      },
    ]);
  });

  it('FR-IMP-2: works on a read-only copy and changes nothing', async () => {
    const { data } = await copy();
    const files = await filesBelow(data);
    for (const file of files) await chmod(file, 0o444);
    readOnly.push(...files);
    const before = await snapshot(data);
    await expect(readLegacy(data)).resolves.toBeDefined();
    expect(await snapshot(data)).toEqual(before);
  });

  it('FR-IMP-2: the fingerprint changes when a file changes', async () => {
    const { data } = await copy();
    const first = (await readLegacy(data)).fingerprint;
    expect((await readLegacy(data)).fingerprint).toBe(first);
    const list = join(data, 'gamelists', 'Nintendo 64.json');
    await writeFile(list, (await readFile(list, 'utf8')).replace('Fuzzy Kart', 'Fuzzy Karts'));
    expect((await readLegacy(data)).fingerprint).not.toBe(first);
  });

  it('FR-IMP-1: missing optional files are fine', async () => {
    const { root: dir } = await copy();
    await writeFile(join(dir, 'launchers.json'), '{}');
    const { files, problems } = await readLegacy(dir);
    expect(files).toMatchObject({ config: null, themes: null, menus: [], gamelists: [] });
    expect(problems).toEqual([]);
  });

  it('FR-IMP-1: a folder that is not a NextLevelOS data folder is refused', async () => {
    const { root } = await copy();
    await expect(readLegacy(root)).rejects.toMatchObject({
      error: { code: 'NOT_FOUND', details: { reason: 'notNextLevelOS' } },
    });
  });
});

describe('runnerSystem', () => {
  it('FR-IMP-2: is the -s name of the runner command, else the launcher key', () => {
    const launchers = {
      'Handy Vision': {
        command: '%NEXTLEVEL_RUNNER% -s "Nintendo NES" -r "%romname%"',
        rompath: [],
      },
      Plain: { command: 'x.exe "%romfilename%"', rompath: [] },
    };
    expect(runnerSystem(launchers, 'Handy Vision')).toBe('Nintendo NES');
    expect(runnerSystem(launchers, 'Plain')).toBe('Plain');
    expect(runnerSystem(launchers, 'Unknown')).toBe('Unknown');
  });
});

describe('collectionLaunchers', () => {
  const launcher = { command: 'x.exe "%romname%"', rompath: [] };
  const launchers = {
    Singe: launcher,
    'American Laser Games': launcher,
    Daphne: launcher,
    Zemmix: launcher,
    'Microsoft MSX': launcher,
  };
  const menus = [
    {
      file: 'menu.json',
      menu: {
        title: 'Menu',
        items: [
          {
            name: 'Laserdisc and VHS',
            items: [
              { name: 'American Laser Games', type: 'collection' },
              { name: 'Daphne', type: 'collection' },
              { name: 'Singe', type: 'system' },
            ],
          },
          { name: 'Zemmix', type: 'system' },
        ],
      },
    },
    {
      file: 'menu-full.json',
      menu: { title: 'Full', items: [{ name: 'zemmix', type: 'collection' }] },
    },
  ];

  it('FR-IMP-1: a list the menus open as a collection, whose games are all elsewhere, is a collection', () => {
    const gamelists = [
      {
        name: 'American Laser Games',
        games: [
          { filename: './crimepatrol-hd.wsquashfs', system: 'Singe' },
          { filename: './maddog-hd.hypseus', system: 'singe' },
        ],
      },
      { name: 'Singe', games: [{ filename: './crimepatrol-hd.wsquashfs' }] },
      // Some games of its own (no system) keep it a system.
      {
        name: 'Daphne',
        games: [{ filename: './astron.wsquashfs', system: 'Singe' }, { filename: './ace.zip' }],
      },
      // A menu opens it as a system: it stays one, wherever its games live.
      { name: 'Zemmix', games: [{ filename: './a.rom', system: 'Microsoft MSX' }] },
    ];
    expect(collectionLaunchers(launchers, gamelists, menus)).toEqual(['American Laser Games']);
  });

  it('FR-IMP-1: an empty list, an unknown system, its own name or no collection node keeps a system', () => {
    const elsewhere = [{ filename: './b.zip', system: 'Singe' }];
    expect(
      collectionLaunchers(
        launchers,
        [
          { name: 'American Laser Games', games: [] },
          { name: 'Daphne', games: [{ filename: './a.zip', system: 'Nowhere' }] },
        ],
        menus,
      ),
    ).toEqual([]);
    expect(
      collectionLaunchers(
        launchers,
        [{ name: 'Daphne', games: [{ filename: './a.zip', system: 'daphne' }] }],
        menus,
      ),
    ).toEqual([]);
    expect(
      collectionLaunchers(launchers, [{ name: 'American Laser Games', games: elsewhere }], []),
    ).toEqual([]);
  });
});
