import { ipcContract } from '@nextlevel/shared';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importHarness, type ImportHarness } from './harness.ts';
import { createImportHandlers } from './importHandlers.ts';

const harnesses: ImportHarness[] = [];
async function setup() {
  const h = await importHarness();
  harnesses.push(h);
  const handlers = createImportHandlers({
    importer: () => h.service,
    folderExists: async (dir) => {
      const { stat } = await import('node:fs/promises');
      return stat(dir).then(
        (info) => info.isDirectory(),
        () => false,
      );
    },
  });
  return { h, handlers };
}
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((h) => h.cleanup()));
});

describe('import handlers (FR-IMP-2, US-B3)', () => {
  it('D14: guesses <parent of the first storage location>\\emulators when it exists', async () => {
    const { h, handlers } = await setup();
    expect(await handlers['import.inspect']({ folder: h.copy.data })).toEqual({
      emulatorsFolder: null,
    });
    // The fixture's priority-1 location is roms\b, so the guess is roms\emulators.
    await mkdir(join(h.copy.root, 'roms', 'emulators'));
    expect(await handlers['import.inspect']({ folder: h.copy.data })).toEqual({
      emulatorsFolder: join(h.copy.root, 'roms', 'emulators'),
    });
  });

  it('FR-IMP-2: dry run then apply through the channels, outputs valid by the contract', async () => {
    const { h, handlers } = await setup();
    const report = await handlers['import.dryRun']({ folder: h.copy.data, emulatorsFolder: null });
    expect(ipcContract['import.dryRun'].output.safeParse(report).success).toBe(true);
    const summary = await handlers['import.apply']({
      folder: h.copy.data,
      emulatorsFolder: null,
      reportToken: report.token,
    });
    expect(ipcContract['import.apply'].output.safeParse(summary).success).toBe(true);
    expect(h.events.some((e) => e.event === 'import.progress')).toBe(true);
  });
});
