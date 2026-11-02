import { AppErrorException } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { followPointer } from './pointerFile.ts';

// FR-EMU-9: Xbox 360 `.m3u` and XBLA `.xbox360` files name the game file inside the system folder.

const SYSTEM = 'E:\\roms\\Microsoft XBOX 360';
const TARGET = `${SYSTEM}\\content\\5th Grader\\58410900\\000D0000\\25B4882BF974A222B9BCA67F0CAA0A32B13CCC2958`;

function deps(texts: Record<string, string>, files: string[] = [TARGET]) {
  return {
    systemDir: SYSTEM,
    extensions: ['m3u', 'xbox360'],
    exists: (path: string) => files.includes(path),
    readText: (path: string) => Promise.resolve(texts[path] ?? ''),
  };
}

async function errorOf(run: () => Promise<unknown>): Promise<AppErrorException['error']> {
  try {
    await run();
  } catch (error) {
    if (error instanceof AppErrorException) return error.error;
    throw error;
  }
  throw new Error('expected an AppErrorException');
}

describe('pointer files (FR-EMU-9)', () => {
  it('FR-EMU-9: an .m3u whose first line is \\content\\… resolves inside the system folder', async () => {
    const rom = `${SYSTEM}\\5th Grader.m3u`;
    const text =
      '\\content\\5th Grader\\58410900\\000D0000\\25B4882BF974A222B9BCA67F0CAA0A32B13CCC2958\r\n';
    expect(await followPointer({ romPath: rom, ...deps({ [rom]: text }) })).toBe(TARGET);
  });

  it('FR-EMU-9: forward slashes, a BOM, blank lines and the extension case are handled', async () => {
    const rom = `${SYSTEM}\\5th Grader.XBOX360`;
    const text =
      '\uFEFF\n  /content/5th Grader/58410900/000D0000/25B4882BF974A222B9BCA67F0CAA0A32B13CCC2958  \nsecond';
    expect(await followPointer({ romPath: rom, ...deps({ [rom]: text }) })).toBe(TARGET);
  });

  it('FR-EMU-9: other extensions are launched as they are, without reading them', async () => {
    const rom = `${SYSTEM}\\Halo.iso`;
    const read: string[] = [];
    const result = await followPointer({
      romPath: rom,
      ...deps({}),
      readText: (path) => {
        read.push(path);
        return Promise.resolve('');
      },
    });
    expect(result).toBe(rom);
    expect(read).toEqual([]);
  });

  it('FR-EMU-9: an empty pointer file fails with pointerEmpty naming the file', async () => {
    const rom = `${SYSTEM}\\Empty.m3u`;
    const error = await errorOf(() => followPointer({ romPath: rom, ...deps({ [rom]: ' \r\n' }) }));
    expect(error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { reason: 'pointerEmpty', path: rom },
    });
  });

  it('FR-EMU-9: a pointer to a missing file fails with pointerMissing naming that file', async () => {
    const rom = `${SYSTEM}\\Gone.m3u`;
    const error = await errorOf(() =>
      followPointer({ romPath: rom, ...deps({ [rom]: '\\content\\Gone\\game.iso' }, []) }),
    );
    expect(error).toMatchObject({
      code: 'LAUNCH_FAILED',
      details: { reason: 'pointerMissing', path: `${SYSTEM}\\content\\Gone\\game.iso` },
    });
  });
});
