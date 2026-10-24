import { LegacyConfigSchema } from '@nextlevel/shared';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { IpcHandlers } from '../ipc/router.ts';
import type { ImportService } from './ImportService.ts';
import { windowsPath } from './mapSettings.ts';

type ImportChannel = Extract<keyof IpcHandlers, `import.${string}`>;

/**
 * D14: `<parent of NextLevelOS's first storage location>\emulators` when that folder exists
 * (`e:/NextLevel/systems` → `e:\NextLevel\emulators`), else null.
 */
async function guessEmulatorsFolder(
  folder: string,
  folderExists: (dir: string) => Promise<boolean>,
): Promise<string | null> {
  const text = await readFile(join(folder, 'config.json'), 'utf8').catch(() => null);
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const config = LegacyConfigSchema.safeParse(raw);
  if (!config.success) return null;
  const [first] = [...config.data.storage].sort(
    (a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity),
  );
  if (!first) return null;
  const candidate = join(dirname(windowsPath(first.path).replace(/\\+$/, '')), 'emulators');
  return (await folderExists(candidate)) ? candidate : null;
}

/** NextLevelOS import channels (FR-IMP-1/2, US-B3); progress arrives as `import.progress`. */
export function createImportHandlers(deps: {
  importer: () => ImportService;
  folderExists: (dir: string) => Promise<boolean>;
}): Pick<IpcHandlers, ImportChannel> {
  return {
    'import.inspect': async ({ folder }) => ({
      emulatorsFolder: await guessEmulatorsFolder(folder, deps.folderExists),
    }),
    'import.dryRun': ({ folder, emulatorsFolder }) =>
      deps.importer().dryRun(folder, emulatorsFolder),
    'import.apply': ({ folder, emulatorsFolder, reportToken }) =>
      deps.importer().apply(folder, emulatorsFolder, reportToken),
  };
}
