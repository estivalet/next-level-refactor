import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { electronPaths, portableRoot } from './portableRoot.ts';

describe('portable root (D50)', () => {
  it('packaged: the data folder sits next to NextLevel.exe', () => {
    const exe = join('E:', 'Games', 'NextLevel', 'NextLevel.exe');
    expect(portableRoot({ execPath: exe, isPackaged: true, appPath: 'ignored' })).toEqual({
      root: join('E:', 'Games', 'NextLevel'),
      data: join('E:', 'Games', 'NextLevel', 'data'),
    });
  });

  it('packaged builds ignore the development override', () => {
    const exe = join('E:', 'NextLevel', 'NextLevel.exe');
    expect(
      portableRoot({ execPath: exe, isPackaged: true, appPath: 'x', override: join('C:', 'e2e') })
        .data,
    ).toBe(join('E:', 'NextLevel', 'data'));
  });

  it('development: <repo>/.nextlevel-dev, the repo two levels above apps/launcher', () => {
    const appPath = join('C:', 'src', 'next-level-claude', 'apps', 'launcher');
    expect(portableRoot({ execPath: 'electron.exe', isPackaged: false, appPath })).toEqual({
      root: resolve(appPath, '../..'),
      data: join(resolve(appPath, '../..'), '.nextlevel-dev'),
    });
  });

  it('development: NEXTLEVEL_USER_DATA wins for data; the root stays the repo', () => {
    const appPath = join('C:', 'src', 'repo', 'apps', 'launcher');
    const override = join('C:', 'tmp', 'e2e');
    expect(
      portableRoot({ execPath: 'electron.exe', isPackaged: false, appPath, override }),
    ).toEqual({
      root: resolve(appPath, '../..'),
      data: override,
    });
  });

  it('every Electron path is inside the data folder', () => {
    const data = join('E:', 'NextLevel', 'data');
    expect(electronPaths(data)).toEqual({
      userData: data,
      sessionData: join(data, 'chromium'),
      logs: join(data, 'logs'),
      crashDumps: join(data, 'crashes'),
      temp: join(data, 'temp'),
    });
  });
});
