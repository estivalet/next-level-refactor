// Runs the Vitest CLI with the Windows drive letter in upper case, both in the working directory
// and in the path Vitest itself is loaded from.
//
// Started from `c:\…` (as VS Code terminals often are), some module URLs use `c:` and others
// `C:`, so Node loads vitest (and chai) twice. jest-dom then extends the copy the tests don't use,
// and every `toBeInTheDocument()` fails with "Invalid Chai property". Vitest reads both as it
// starts (its workers are spawned from its own path), so this can't be fixed in vitest.config.ts.
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const upperDrive = (p) => (/^[a-z]:/.test(p) ? p.charAt(0).toUpperCase() + p.slice(1) : p);

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32') {
  root = upperDrive(root);
  process.chdir(upperDrive(process.cwd()));
}

// The CLI entry (what `npx vitest` runs) isn't in vitest's package exports, so load it by path.
await import(pathToFileURL(path.join(root, 'node_modules', 'vitest', 'vitest.mjs')).href);
