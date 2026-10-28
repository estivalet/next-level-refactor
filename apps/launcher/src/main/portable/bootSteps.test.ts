import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemp, oldDataSource, portableEnv } from './bootSteps.ts';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('boot steps (D50, review)', () => {
  it('the old AppData folder is only moved in when the data folder is the real one', () => {
    const appData = 'C:\\Users\\me\\AppData\\Roaming';
    expect(oldDataSource({ appData, isPackaged: true, overridden: false })).toBe(
      join(appData, 'NextLevel'),
    );
    expect(oldDataSource({ appData, isPackaged: false, overridden: false })).toBe(
      join(appData, 'NextLevel-dev'),
    );
    // e2e (NEXTLEVEL_USER_DATA) must never take the developer's real data.
    expect(oldDataSource({ appData, isPackaged: false, overridden: true })).toBeNull();
  });

  it('TMP and TEMP point into the data folder; the original environment is kept for emulators', () => {
    const env = { TMP: 'C:\\Users\\me\\AppData\\Local\\Temp', TEMP: 'C:\\x', PATH: 'p' };
    const { launcher, original } = portableEnv(env, 'E:\\NextLevel\\data\\temp');
    expect(launcher).toMatchObject({
      TMP: 'E:\\NextLevel\\data\\temp',
      TEMP: 'E:\\NextLevel\\data\\temp',
      PATH: 'p',
    });
    expect(original).toEqual(env);
    expect(original).not.toBe(env);
  });

  it('emptying temp is best effort: a locked file is logged, the boot goes on', async () => {
    const base = await mkdtemp(join(tmpdir(), 'nextlevel-temp-'));
    dirs.push(base);
    const temp = join(base, 'temp');
    await mkdir(temp);
    await writeFile(join(temp, 'old.bin'), 'x');
    const warnings: object[] = [];
    await cleanTemp(
      temp,
      { warn: (context) => warnings.push(context) },
      {
        ...fs,
        rm: () => Promise.reject(Object.assign(new Error('busy'), { code: 'EBUSY' })),
      },
    );
    expect(warnings).toHaveLength(1);
    expect(await readdir(base)).toEqual(['temp']);
  });

  it('emptying temp removes what is there and leaves an empty folder', async () => {
    const base = await mkdtemp(join(tmpdir(), 'nextlevel-temp-'));
    dirs.push(base);
    const temp = join(base, 'temp');
    await mkdir(join(temp, 'extract-1'), { recursive: true });
    await writeFile(join(temp, 'extract-1', 'game.bin'), 'x');
    await cleanTemp(temp, { warn: () => undefined });
    expect(await readdir(temp)).toEqual([]);
  });
});
