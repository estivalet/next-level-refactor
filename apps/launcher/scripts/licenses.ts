// Writes resources/licenses.txt: the name, version, license and license text of every package
// the packaged launcher ships (its production dependencies, transitively). Run before packaging:
//   node scripts/licenses.ts
// Workspace packages (@nextlevel/*) are NextLevel's own and are not listed.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  /** The package's LICENSE file, or null when it ships none. */
  text: string | null;
}

interface PackageJson {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const readJson = (file: string): PackageJson =>
  JSON.parse(readFileSync(file, 'utf8')) as PackageJson;

/** Node's lookup: `<dir>/node_modules/<name>`, then each parent folder's. */
function resolvePackage(name: string, fromDir: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function licenseText(dir: string): string | null {
  const file = readdirSync(dir).find((entry) => /^(licen[cs]e|copying)(\.|$)/i.test(entry));
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null;
}

function licenseName(json: PackageJson): string {
  if (typeof json.license === 'string') return json.license;
  return json.license?.type ?? 'UNKNOWN';
}

/** Every production dependency of the package in `appDir`, once each, sorted by name. */
export function collectLicenses(appDir: string): LicenseEntry[] {
  const found = new Map<string, LicenseEntry>();
  const visited = new Set<string>();
  const visit = (dir: string, json: PackageJson) => {
    const deps = { ...json.dependencies, ...json.optionalDependencies };
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@nextlevel/')) continue;
      const at = resolvePackage(name, dir);
      // A missing optional dependency (another platform's binary) is not shipped.
      if (!at || visited.has(at)) continue;
      visited.add(at);
      const child = readJson(join(at, 'package.json'));
      const entry = {
        name,
        version: child.version ?? '0.0.0',
        license: licenseName(child),
        text: licenseText(at),
      };
      found.set(`${name}@${entry.version}`, entry);
      visit(at, child);
    }
  };
  visit(appDir, readJson(join(appDir, 'package.json')));
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

export function formatLicenses(entries: readonly LicenseEntry[]): string {
  const header =
    'NextLevel includes the following third-party software. Electron and Chromium licenses are in LICENSE.electron.txt and LICENSES.chromium.html next to NextLevel.exe.';
  const blocks = entries.map(
    (entry) =>
      `${entry.name} ${entry.version} (${entry.license})\n\n${entry.text ?? '(no license file in the package)'}`,
  );
  return `${[header, ...blocks].join(`\n\n${'-'.repeat(72)}\n\n`)}\n`;
}

if (import.meta.main) {
  const appDir = resolve(import.meta.dirname, '..');
  const out = join(appDir, 'resources', 'licenses.txt');
  mkdirSync(dirname(out), { recursive: true });
  const entries = collectLicenses(appDir);
  writeFileSync(out, formatLicenses(entries));
  console.log(`licenses: ${String(entries.length)} packages → ${out}`);
}
