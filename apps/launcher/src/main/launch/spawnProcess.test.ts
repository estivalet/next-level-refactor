import { AppErrorException } from '@nextlevel/shared';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDir } from '../library/testing.ts';
import { spawnProcess, STDERR_TAIL_BYTES } from './spawnProcess.ts';
import { FAKE_EMULATOR } from './testing.ts';

let temp: Awaited<ReturnType<typeof tempDir>>;
beforeEach(async () => {
  temp = await tempDir('nextlevel-spawn-');
});
afterEach(async () => {
  await temp.cleanup();
});

describe('spawnProcess (ADR-004)', () => {
  it('FR-EMU-5: passes argv unchanged and reports exit code and stderr', async () => {
    const out = join(temp.dir, 'argv.json');
    const rom = 'E:\\roms\\Pokémon & Friends (USA) [!] 100% "x".zip';
    const running = await spawnProcess({
      executable: process.execPath,
      args: [FAKE_EMULATOR, '--out', out, '--stderr', 'bad thing', '--exit', '3', rom],
      cwd: temp.dir,
      env: { ...process.env, NEXTLEVEL_FAKE: 'yes' },
    });
    expect(await running.exited).toEqual({ exitCode: 3 });
    expect(running.stderrTail()).toBe('bad thing');
    const recorded = JSON.parse(await readFile(out, 'utf8')) as { argv: string[]; fake: string };
    expect(recorded.argv.at(-1)).toBe(rom);
    expect(recorded.fake).toBe('yes');
  });

  it('FR-EMU-10: keeps only the last 4 KiB of stderr', async () => {
    const running = await spawnProcess({
      executable: process.execPath,
      args: [FAKE_EMULATOR, '--stderr', `${'a'.repeat(5000)}END`],
      cwd: temp.dir,
      env: {},
    });
    await running.exited;
    expect(running.stderrTail()).toHaveLength(STDERR_TAIL_BYTES);
    expect(running.stderrTail().endsWith('aEND')).toBe(true);
  });

  it('US-C2: an executable that can’t start rejects with LAUNCH_FAILED', async () => {
    await expect(
      spawnProcess({ executable: join(temp.dir, 'nope.exe'), args: [], cwd: temp.dir, env: {} }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AppErrorException && error.error.code === 'LAUNCH_FAILED',
    );
  });
});
