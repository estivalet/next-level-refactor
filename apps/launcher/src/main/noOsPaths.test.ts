import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// D50: the launcher writes only inside its own folder. Main code never asks the OS for its temp,
// AppData, Documents or home folders; only main/portable/ may look up the old AppData folder.

const FORBIDDEN = [
  /\bos\.(tmpdir|homedir)\b/,
  /\b(tmpdir|homedir)\(\)/,
  /getPath\(\s*['"`](temp|appData|documents|home|desktop|downloads|cache)['"`]\s*\)/,
  /process\.env(\.|\[\s*['"`])(TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEPATH|HOMEDRIVE)\b/,
];

const offending = (line: string) => FORBIDDEN.some((pattern) => pattern.test(line));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'portable' ? [] : sources(path);
    const test = /\.test\.tsx?$/.test(entry.name) || entry.name === 'testing.ts';
    return /\.tsx?$/.test(entry.name) && !test ? [path] : [];
  });
}

describe('no OS folders in main (D50)', () => {
  it.each([
    'const home = os.homedir();',
    'const home = homedir();',
    'const t = os.tmpdir();',
    'const roaming = process.env.APPDATA;',
    "const local = process.env['LOCALAPPDATA'];",
    'const profile = process.env.USERPROFILE ?? "";',
    'const temp = app.getPath(`temp`);',
    "const shots = app.getPath('desktop');",
    "const d = app.getPath('downloads');",
    "const c = app.getPath( 'cache' );",
  ])('the check finds %s', (line) => {
    expect(offending(line)).toBe(true);
  });

  it.each([
    "const data = join(root, 'data');",
    "const exe = app.getPath('exe');",
    "const flag = process.env['NEXTLEVEL_AUTH'];",
    'const tempo = process.env.TEMPO;',
  ])('the check allows %s', (line) => {
    expect(offending(line)).toBe(false);
  });

  it('main code never uses the OS temp, AppData, Documents or home folders', () => {
    const root = import.meta.dirname;
    const offenders = sources(root).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          offending(line) ? [`${relative(root, file)}:${String(index + 1)}: ${line.trim()}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
