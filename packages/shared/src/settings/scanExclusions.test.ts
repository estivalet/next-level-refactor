import { describe, expect, it } from 'vitest';
import {
  exclusionFolderOf,
  hasExclusion,
  ScanExclusionsSchema,
  systemFolders,
} from './scanExclusions.ts';
import { SystemSettingsSchema } from './schema.ts';

const issues = (value: unknown) => {
  const result = ScanExclusionsSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message]);
};

describe('scan exclusions (FR-LIB-15)', () => {
  it('FR-LIB-15: a system keeps patterns and folders; none by default', () => {
    expect(SystemSettingsSchema.parse({}).scanExclusions).toBeUndefined();
    const exclusions = [
      { kind: 'pattern', pattern: ' *updates_dlcs ' },
      { kind: 'folder', path: 'updates_dlcs/old' },
    ];
    expect(SystemSettingsSchema.parse({ scanExclusions: exclusions }).scanExclusions).toEqual([
      { kind: 'pattern', pattern: '*updates_dlcs' },
      { kind: 'folder', path: 'updates_dlcs/old' },
    ]);
  });

  it('FR-LIB-15: empty entries and names with path characters are refused', () => {
    expect(ScanExclusionsSchema.safeParse([{ kind: 'pattern', pattern: '  ' }]).success).toBe(
      false,
    );
    expect(ScanExclusionsSchema.safeParse([{ kind: 'pattern', pattern: 'a\\b' }]).success).toBe(
      false,
    );
    expect(ScanExclusionsSchema.safeParse([{ kind: 'pattern', pattern: 'a/b' }]).success).toBe(
      false,
    );
  });

  it('FR-LIB-15: a folder must be a plain path inside the system folder', () => {
    for (const path of ['E:\\roms\\x', '/x', '../x', 'a/../b', 'a//b', 'a\\b', '']) {
      expect(issues([{ kind: 'folder', path }]), path).not.toEqual([]);
    }
    expect(issues([{ kind: 'folder', path: 'E:\\roms\\x' }])).toEqual([
      ['0.path', 'notInSystemFolder'],
    ]);
  });

  it('FR-LIB-15: a repeated entry is refused, ignoring case', () => {
    expect(
      issues([
        { kind: 'pattern', pattern: '*[v*' },
        { kind: 'folder', path: 'Updates' },
        { kind: 'pattern', pattern: '*[V*' },
        { kind: 'folder', path: 'updates' },
      ]),
    ).toEqual([
      ['2', 'duplicateExclusion'],
      ['3', 'duplicateExclusion'],
    ]);
  });

  it('FR-LIB-15: hasExclusion matches like the duplicate check', () => {
    const list = [{ kind: 'pattern', pattern: '*[v*' } as const];
    expect(hasExclusion(list, { kind: 'pattern', pattern: ' *[V* ' })).toBe(true);
    expect(hasExclusion(list, { kind: 'folder', path: '*[v*' })).toBe(false);
  });

  it('FR-LIB-15: systemFolders joins each storage location with the folder name', () => {
    expect(
      systemFolders(
        [
          { path: 'E:\\roms\\', priority: 1 },
          { path: 'F:/more', priority: 2 },
        ],
        'Nintendo Switch',
      ),
    ).toEqual(['E:\\roms\\Nintendo Switch', 'F:\\more\\Nintendo Switch']);
  });

  it('FR-LIB-15, US-D8: a picked folder is kept relative to the system folder', () => {
    const dirs = ['E:\\roms\\Nintendo Switch', 'F:\\more\\Nintendo Switch'];
    expect(exclusionFolderOf('D:\\x', dirs)).toBeNull();
    expect(exclusionFolderOf('E:\\roms\\Nintendo Switch', dirs)).toBeNull();
    expect(exclusionFolderOf('E:\\roms\\Nintendo Switch Extra\\x', dirs)).toBeNull();
    expect(exclusionFolderOf('e:\\ROMS\\nintendo switch\\updates_dlcs\\', dirs)).toBe(
      'updates_dlcs',
    );
    expect(exclusionFolderOf('F:/more/Nintendo Switch/_review/Old Ones', dirs)).toBe(
      '_review/Old Ones',
    );
  });
});
