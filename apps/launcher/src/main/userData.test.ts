import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { userDataDirName, userDataPath } from './userData.ts';

describe('userDataDirName', () => {
  it('dev builds use NextLevel-dev so they never touch a production install', () => {
    expect(userDataDirName(false)).toBe('NextLevel-dev');
    expect(userDataDirName(true)).toBe('NextLevel');
  });
});

describe('userDataPath', () => {
  const appData = 'C:/Users/me/AppData/Roaming';

  it('uses NextLevel under AppData when packaged, even if an override is set', () => {
    expect(userDataPath({ appData, isPackaged: true, override: 'C:/tmp/e2e' })).toBe(
      join(appData, 'NextLevel'),
    );
  });

  it('uses NextLevel-dev in development', () => {
    expect(userDataPath({ appData, isPackaged: false, override: undefined })).toBe(
      join(appData, 'NextLevel-dev'),
    );
  });

  it('lets tests point development builds at a throwaway folder', () => {
    expect(userDataPath({ appData, isPackaged: false, override: 'C:/tmp/e2e' })).toBe('C:/tmp/e2e');
  });
});
