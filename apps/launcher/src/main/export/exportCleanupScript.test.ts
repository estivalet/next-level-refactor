import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainText } from '../i18n/mainText.ts';
import type { DeleteLaterGame } from '../library/GameExportReader.ts';
import { tempDir } from '../library/testing.ts';
import type { CleanupGame } from './cleanupFiles.ts';
import { exportCleanupScript } from './exportCleanupScript.ts';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const scope = { kind: 'system', systemId: 'gamegear' } as const;
const marked: DeleteLaterGame[] = [
  { title: 'A', systemId: 'gamegear', system: 'GG', relPath: 'a.gg', discGroup: null },
  { title: 'B', systemId: 'gamegear', system: 'GG', relPath: 'b.cue', discGroup: null },
];
const found: CleanupGame[] = [
  { title: 'A', system: 'GG', files: [entry('D:\\a.gg')], notes: [] },
  { title: 'B', system: 'GG', files: [entry('D:\\b.cue'), entry('D:\\b.bin')], notes: [] },
];

function entry(path: string) {
  return { path, location: 'D', size: 1, folder: false };
}

function deps(pickPath: (name: string) => Promise<string | null>) {
  return {
    reader: { deleteLaterGames: vi.fn(() => marked) },
    files: vi.fn(() => Promise.resolve(found)),
    pickPath: vi.fn(pickPath),
    clock: () => new Date(Date.UTC(2026, 10, 25)),
    text: (key: string) => mainText('en', key),
  };
}

describe('exportCleanupScript', () => {
  it('FR-LIB-20: suggests "delete-later-<title>.ps1"', async () => {
    const d = deps(() => Promise.resolve(null));
    await exportCleanupScript(d, { scope, title: 'Sega: Game Gear' });
    expect(d.pickPath).toHaveBeenCalledWith('delete-later-Sega_ Game Gear.ps1');
  });

  it('FR-LIB-20: cancelling writes nothing', async () => {
    const d = deps(() => Promise.resolve(null));
    const result = await exportCleanupScript(d, { scope, title: 'GG' });
    expect(result).toEqual({ status: 'cancelled' });
    expect(d.reader.deleteLaterGames).toHaveBeenCalledWith(scope);
    expect(d.files).not.toHaveBeenCalled();
  });

  it('FR-LIB-20: saving writes the script and counts games and files', async () => {
    const temp = await tempDir();
    cleanups.push(temp.cleanup);
    const file = join(temp.dir, 'out.ps1');
    const d = deps(() => Promise.resolve(file));

    const result = await exportCleanupScript(d, { scope, title: 'GG' });

    expect(result).toEqual({ status: 'saved', games: 2, files: 3 });
    expect(d.files).toHaveBeenCalledWith(marked);
    const text = await readFile(file, 'utf8');
    expect(text.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(text).toContain("Remove-ToRecycleBin 'D:\\b.bin'");
    expect(text).toContain('2026-11-25T00:00:00.000Z');
  });
});
