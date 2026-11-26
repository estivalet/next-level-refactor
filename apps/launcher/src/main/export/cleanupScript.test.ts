import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mainText } from '../i18n/mainText.ts';
import type { CleanupGame } from './cleanupFiles.ts';
import { renderCleanupScript } from './cleanupScript.ts';

const meta = {
  scope: 'Sega Game Gear',
  exportedAt: '2026-11-25T12:00:00.000Z',
  text: (key: string) => mainText('en', key),
};

const file = (path: string, location = 'A', size = 1_000_000) => ({
  path,
  location,
  size,
  folder: false,
});

const games: CleanupGame[] = [
  {
    title: 'Coca-Cola Kid',
    system: 'Sega Game Gear',
    files: [file('E:\\roms\\Game Gear\\x.gg', 'B'), file('D:\\roms\\Game Gear\\x.gg')],
    notes: [{ kind: 'catalog', path: 'F:\\games\\Game Gear\\x.gg' }],
  },
  { title: 'Buster Ball', system: 'Sega Game Gear', files: [file('D:\\y.gg')], notes: [] },
];

const lines = (script: string) => script.replace(/^\uFEFF/, '').split('\r\n');

describe('renderCleanupScript', () => {
  it('FR-LIB-20: the script starts with a BOM and uses CRLF', () => {
    const script = renderCleanupScript(games, meta);
    expect(script.startsWith('\uFEFF')).toBe(true);
    expect(/[^\r]\n/.test(script)).toBe(false);
  });

  it('FR-LIB-20: the header counts games, files and size', () => {
    const script = renderCleanupScript(games, meta);
    expect(script).toContain('Sega Game Gear');
    expect(script).toContain('2 games, 3 files, 2.9 MB');
  });

  it('FR-LIB-20: one line per file, with its location', () => {
    const all = lines(renderCleanupScript(games, meta));
    const deletes = all.filter((line) => line.startsWith('Remove-ToRecycleBin '));
    expect(deletes).toHaveLength(3);
    expect(deletes[0]).toMatch(/^Remove-ToRecycleBin 'E:\\roms\\Game Gear\\x\.gg'\s+# B$/);
    expect(all).toContain('# Coca-Cola Kid · Sega Game Gear');
  });

  it('US-C14: quotes in a path are doubled', () => {
    const script = renderCleanupScript(
      [{ title: 't', system: 's', files: [file("E:\\r\\Kid's ‘x’.gg")], notes: [] }],
      meta,
    );
    expect(script).toContain("Remove-ToRecycleBin 'E:\\r\\Kid''s ‘‘x’’.gg'");
  });

  it("US-C14: a title can't break out of its comment", () => {
    const script = renderCleanupScript(
      [{ title: 'Evil\r\nRemove-Item C:\\', system: 's\nx', files: [], notes: [] }],
      meta,
    );
    expect(lines(script).some((line) => line.startsWith('Remove-Item'))).toBe(false);
    expect(lines(script).some((line) => line.startsWith('x'))).toBe(false);
  });

  it('FR-LIB-20: notes are comments', () => {
    const all = lines(renderCleanupScript(games, meta));
    expect(all).toContain('# installed from Catalog, use Uninstall: F:\\games\\Game Gear\\x.gg');
  });

  it('FR-LIB-20: a game with nothing found says so', () => {
    const all = lines(
      renderCleanupScript([{ title: 'Gone', system: 's', files: [], notes: [] }], meta),
    );
    expect(all).toContain('# no files found');
  });

  it('FR-LIB-20: no permanent delete', () => {
    const script = renderCleanupScript(games, meta);
    expect(script).not.toContain('Remove-Item');
    for (const call of script.match(/::Delete(File|Directory)\([^)]*\)/g) ?? []) {
      expect(call).toContain('SendToRecycleBin');
    }
    expect(script).toMatch(/::DeleteFile\(/);
  });

  it('FR-LIB-20: the script is written in the launcher language', () => {
    const script = renderCleanupScript(games, {
      ...meta,
      text: (key: string) => mainText('pt-BR', key),
    });
    expect(script).toContain('2 jogos, 3 arquivos');
  });
});

const POWERSHELL = join(
  process.env['SystemRoot'] ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function run(args: string[]): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(POWERSHELL, args, { shell: false, windowsHide: true });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, out });
    });
  });
}

describe('renderCleanupScript in Windows PowerShell', () => {
  it.skipIf(process.platform !== 'win32')(
    'FR-LIB-20: the script runs in Windows PowerShell',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'nl-script-'));
      roots.push(root);
      const bracket = join(root, 'a [T-En].gg');
      const quote = join(root, "b's.gg");
      const gone = join(root, 'never.gg');
      const network = String.raw`\\nas\share\x.gg`;
      await writeFile(bracket, 'x');
      await writeFile(quote, 'x');
      const script = join(root, 'cleanup.ps1');
      await writeFile(
        script,
        renderCleanupScript(
          [
            {
              title: 't',
              system: 's',
              files: [file(bracket), file(quote), file(gone), file(network)],
              notes: [],
            },
          ],
          meta,
        ),
      );

      const { code, out } = await run([
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-DryRun',
      ]);

      expect(out).toContain(`Would recycle: ${bracket}`);
      expect(out).toContain(`Would recycle: ${quote}`);
      expect(out).toContain(`Already gone: ${gone}`);
      // Recycling there would delete for good; checked before the drive is ever touched.
      expect(out).toContain(`Skipped (not deleted): ${network}: no Recycle Bin on this drive`);
      expect(code).toBe(0);
      expect(existsSync(bracket) && existsSync(quote)).toBe(true);
    },
    30_000,
  );
});
