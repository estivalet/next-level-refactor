import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { exportFileName, exportGames } from './exportGames.ts';
import type { ExportGame } from './formats.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const racer = { title: 'Racer', year: 1997 } as ExportGame;
const scope = { kind: 'system', systemId: 'nintendo-64' } as const;

describe('exportGames', () => {
  it('FR-LIB-11: suggests a safe file name, and gamelist.xml for ES', () => {
    expect(exportFileName('Nintendo 64', 'csv')).toBe('Nintendo 64.csv');
    expect(exportFileName('A/B: "best"?', 'json')).toBe('A_B_ _best__.json');
    expect(exportFileName('...', 'csv')).toBe('games.csv');
    expect(exportFileName('Nintendo 64', 'gamelistXml')).toBe('gamelist.xml');
  });

  it('FR-LIB-11: writes the picked file and reports how many games went in', async () => {
    const temp = await tempDir();
    cleanups.push(temp.cleanup);
    const file = join(temp.dir, 'out.csv');
    const read = vi.fn(() => [racer]);
    const pickPath = vi.fn(() => Promise.resolve(file));

    const result = await exportGames(
      { reader: { read }, pickPath, clock: () => new Date(Date.UTC(2026, 10, 1)) },
      { scope, view: { tab: 'favorites' }, format: 'csv', fields: ['year'], title: 'N64' },
    );

    expect(result).toEqual({ status: 'saved', count: 1 });
    expect(read).toHaveBeenCalledWith(scope, { tab: 'favorites' });
    expect(pickPath).toHaveBeenCalledWith('N64.csv', 'csv');
    const bom = String.fromCharCode(0xfeff);
    expect(await readFile(file, 'utf8')).toBe(`${bom}title,year\r\nRacer,1997\r\n`);
  });

  it('FR-LIB-11: a cancelled Save dialog writes nothing', async () => {
    const result = await exportGames(
      {
        reader: { read: () => [racer] },
        pickPath: () => Promise.resolve(null),
        clock: () => new Date(),
      },
      { scope, view: null, format: 'json', fields: ['title'], title: 'N64' },
    );
    expect(result).toEqual({ status: 'cancelled' });
  });

  it('FR-LIB-11: a scope that is gone fails before the Save dialog', async () => {
    const pickPath = vi.fn(() => Promise.resolve('x'));
    await expect(
      exportGames(
        {
          reader: {
            read: () => {
              throw new Error('NOT_FOUND');
            },
          },
          pickPath,
          clock: () => new Date(),
        },
        { scope, view: null, format: 'csv', fields: ['title'], title: 'N64' },
      ),
    ).rejects.toThrow('NOT_FOUND');
    expect(pickPath).not.toHaveBeenCalled();
  });
});
