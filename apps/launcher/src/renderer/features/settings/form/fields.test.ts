import { GeneralSchema, SettingsSchema } from '@nextlevel/shared';
import { describe, expect, it } from 'vitest';
import { fieldsOf, getAt, issuesByPath, setAt } from './fields.ts';

describe('fieldsOf', () => {
  it('FR-SET-1: describes the editable General fields from schema metadata', () => {
    expect(fieldsOf(GeneralSchema, 'general')).toEqual([
      {
        path: 'general.language',
        kind: 'enum',
        options: ['en', 'pt-BR'],
        labelKey: 'settings.fields.general.language.label',
        helpKey: 'settings.fields.general.language.help',
      },
      {
        path: 'general.startWithWindows',
        kind: 'boolean',
        labelKey: 'settings.fields.general.startWithWindows.label',
        helpKey: 'settings.fields.general.startWithWindows.help',
      },
    ]);
  });
});

describe('issuesByPath', () => {
  it('FR-SET-2: maps each invalid field to a message key', () => {
    const result = SettingsSchema.safeParse({ schemaVersion: 1, general: { language: 'xx' } });
    if (result.success) throw new Error('expected failure');
    expect(issuesByPath(result.error)).toEqual({
      'general.language': 'errors.validation.invalid_value',
    });
  });
});

describe('issuesByPath for custom checks', () => {
  it('FR-LIB-1: a storage location check maps to its own message key', () => {
    const location = { id: '01928c3e-0000-7000-8000-000000000001', name: 'a', priority: 1 };
    const result = SettingsSchema.safeParse({
      schemaVersion: 1,
      storage: {
        locations: [
          { ...location, path: 'E:/roms' },
          { ...location, id: '01928c3e-0000-7000-8000-000000000002', name: 'b', path: 'e:/ROMS' },
        ],
      },
    });
    if (result.success) throw new Error('expected failure');
    expect(issuesByPath(result.error)).toEqual({
      'storage.locations.1.path': 'errors.validation.duplicatePath',
    });
  });
});

describe('getAt / setAt', () => {
  it('reads and immutably writes dotted paths', () => {
    const before = { a: { b: 1, c: 2 } };
    const after = setAt(before, 'a.b', 5);
    expect(after).toEqual({ a: { b: 5, c: 2 } });
    expect(before.a.b).toBe(1);
    expect(getAt(after, 'a.b')).toBe(5);
  });
});
