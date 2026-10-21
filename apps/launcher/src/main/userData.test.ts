import { describe, expect, it } from 'vitest';
import { userDataDirName } from './userData.ts';

describe('userDataDirName', () => {
  it('dev builds use NextLevel-dev so they never touch a production install', () => {
    expect(userDataDirName(false)).toBe('NextLevel-dev');
    expect(userDataDirName(true)).toBe('NextLevel');
  });
});
