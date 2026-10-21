import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnProcess } from './spawnProcess.ts';
import { FAKE_EMULATOR, launchHarness } from './testing.ts';

// A real process: node running the fake emulator, which records the argv it received.
let h: Awaited<ReturnType<typeof launchHarness>>;
beforeEach(async () => {
  h = await launchHarness({
    spawn: spawnProcess,
    romFile: 'Pokémon & Friends (USA) [!] 100% "Rev 1".zip',
  });
});
afterEach(async () => {
  await h.cleanup();
});

describe('LaunchService with a real process (test-strategy fake-emulator)', () => {
  it('FR-EMU-5, ADR-004: Test launch passes the ROM as one element and reports exit and stderr', async () => {
    const out = join(h.tempDir, 'argv.json');
    h.setEmulatorExe(process.execPath);
    h.setProfileArgs([FAKE_EMULATOR, '--out', out, '--stderr', 'oops', '--exit', '3', '{rom}']);
    const result = await h.service.test({ ...h.draft(), gameId: h.gameId });
    expect(result).toMatchObject({ exitCode: 3, stderrTail: 'oops' });
    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[]; cwd: string };
    expect(recorded.argv.at(-1)).toBe(h.romPath);
    expect(recorded.cwd.toLowerCase()).toBe(join(process.execPath, '..').toLowerCase());
  });
});
