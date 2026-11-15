// Regenerates data/system-info.json from the owner's scraped system-info folder. Dev-only; never
// runs in tests or CI. The folder is only read.
//
//   npm run import:system-info -w packages/system-catalog -- <folder> > <report.json>
//
// The folder holds one `<System name>.json` per system plus `00_lb_metadata.xml` (LaunchBox
// Platforms.xml). The report goes to stdout; keep it outside the repo.

import { SystemInfoSeedFileSchema } from '@nextlevel/shared';
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { systemCatalog } from '../src/index.ts';
import { runImport } from './systemInfo/runImport.ts';

const folder = process.argv[2];
if (!folder) {
  console.error('usage: importSystemInfo.ts <folder>');
  process.exit(1);
}

const names = readdirSync(folder);
const files = names
  .filter((name) => name.toLowerCase().endsWith('.json'))
  .map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));
const xmlName = names.find((name) => name === '00_lb_metadata.xml');
const xml = xmlName ? readFileSync(join(folder, xmlName), 'utf8') : null;

const { seed, report } = runImport(files, xml, systemCatalog());
SystemInfoSeedFileSchema.parse(seed);

// Write to a temp file and rename, so an interrupted run never leaves a half-written seed.
const out = join(import.meta.dirname, '..', 'data', 'system-info.json');
const temp = `${out}.tmp`;
writeFileSync(temp, `${JSON.stringify(seed, null, 2)}\n`);
renameSync(temp, out);

console.log(JSON.stringify(report, null, 2));
