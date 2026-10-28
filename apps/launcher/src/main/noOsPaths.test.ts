import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// D50: the launcher writes only inside its own folder. Main code never asks the OS for its temp,
// AppData, Documents or home folders; only main/portable/ may look up the old AppData folder.

const FORBIDDEN = [
  /\bos\.tmpdir\b/,
  /\btmpdir\(\)/,
  /getPath\(\s*['"](temp|appData|documents|home)['"]\s*\)/,
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'portable' ? [] : sources(path);
    const test = /\.test\.tsx?$/.test(entry.name) || entry.name === 'testing.ts';
    return /\.tsx?$/.test(entry.name) && !test ? [path] : [];
  });
}

describe('no OS folders in main (D50)', () => {
  it('main code never uses the OS temp, AppData, Documents or home folders', () => {
    const root = import.meta.dirname;
    const offenders = sources(root).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          FORBIDDEN.some((pattern) => pattern.test(line))
            ? [`${relative(root, file)}:${String(index + 1)}: ${line.trim()}`]
            : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});
