import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// NFR-MAINT-2: every requirement traces to at least one test or a documented manual check (the
// release checklist). Keeps the trace from rotting as requirements are added.

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const SKIP = new Set(['node_modules', 'dist', 'out', '.vitest-cache', 'test-results']);

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return /\.(test|spec)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('requirements trace (NFR-MAINT-2)', () => {
  it('NFR-MAINT-2: every FR/NFR id is named by a test or by a manual check in the release checklist', () => {
    const requirements = readFileSync(
      join(ROOT, 'docs', '01-product', '02-product-requirements.md'),
      'utf8',
    );
    const ids = [...requirements.matchAll(/^\| ((?:FR|NFR)-[A-Z0-9]+-\d+) \|/gm)].map(
      (match) => match[1] ?? '',
    );
    expect(ids.length).toBeGreaterThan(90);
    const traced = [
      ...['apps', 'packages'].flatMap((dir) => testFiles(join(ROOT, dir))),
      join(ROOT, 'docs', '04-quality', 'release-checklist.md'),
    ]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const untraced = ids.filter((id) => !new RegExp(`\\b${id}\\b`).test(traced));
    expect(untraced).toEqual([]);
  });
});
