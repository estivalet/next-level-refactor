import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectLicenses, formatLicenses } from './licenses.ts';

const launcherDir = resolve(import.meta.dirname, '..');

describe('third-party licenses (release checklist)', () => {
  it('licenses: lists electron-log with MIT', () => {
    const entries = collectLicenses(launcherDir);
    const log = entries.find((entry) => entry.name === 'electron-log');
    expect(log).toMatchObject({ license: 'MIT' });
    expect(log?.text).toMatch(/MIT License|Permission is hereby granted/);
    // Transitive dependencies are listed too; workspace packages are NextLevel's own.
    expect(entries.some((entry) => entry.name === 'builder-util-runtime')).toBe(true);
    expect(entries.some((entry) => entry.name.startsWith('@nextlevel/'))).toBe(false);
    // Development tools never ship.
    expect(entries.some((entry) => entry.name === 'vitest')).toBe(false);
  });

  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it('a nested copy wins over the hoisted one, each package once, sorted by name', async () => {
    dir = await mkdtemp(join(tmpdir(), 'nextlevel-licenses-'));
    const pkg = async (at: string, json: object, license?: string) => {
      await mkdir(at, { recursive: true });
      await writeFile(join(at, 'package.json'), JSON.stringify(json));
      if (license) await writeFile(join(at, 'LICENSE.md'), license);
    };
    await pkg(join(dir, 'app'), { dependencies: { b: '*', a: '*' } });
    await pkg(
      join(dir, 'node_modules', 'a'),
      {
        name: 'a',
        version: '1.0.0',
        license: 'ISC',
        dependencies: { c: '*' },
      },
      'ISC text',
    );
    await pkg(join(dir, 'node_modules', 'b'), {
      name: 'b',
      version: '2.0.0',
      license: { type: 'MIT' },
      dependencies: { a: '*' },
    });
    await pkg(join(dir, 'node_modules', 'c'), { name: 'c', version: '9.0.0', license: 'MIT' });
    await pkg(join(dir, 'node_modules', 'a', 'node_modules', 'c'), {
      name: 'c',
      version: '3.0.0',
      license: 'Apache-2.0',
    });
    const entries = collectLicenses(join(dir, 'app'));
    expect(entries.map((entry) => `${entry.name}@${entry.version} ${entry.license}`)).toEqual([
      'a@1.0.0 ISC',
      'b@2.0.0 MIT',
      'c@3.0.0 Apache-2.0',
    ]);
    const text = formatLicenses(entries);
    expect(text).toContain('a 1.0.0 (ISC)\n\nISC text');
    expect(text).toContain('b 2.0.0 (MIT)\n\n(no license file in the package)');
  });
});
