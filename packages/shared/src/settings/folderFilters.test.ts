import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import ptBR from '../i18n/pt-BR.json';
import {
  FolderFiltersSchema,
  KNOWN_FILTERS,
  folderFilterRules,
  folderFiltersOf,
  folderFiltersFingerprint,
} from './folderFilters.ts';
import { SettingsSchema } from './schema.ts';

const defaults = folderFilterRules(FolderFiltersSchema.parse({}));
const issues = (value: unknown) => {
  const result = FolderFiltersSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message]);
};

describe('folder filters (FR-LIB-18, US-C12)', () => {
  it('FR-LIB-18: defaults are the ! and + prefixes, Official outside, no renames', () => {
    const settings = SettingsSchema.parse({ schemaVersion: 3 });
    expect(settings.storage.folderFilters).toEqual({
      prefixes: ['!', '+'],
      outside: 'Official',
      renames: [],
    });
  });

  it('US-C12: a game in `! Prototypes` gets prototypes', () => {
    expect(folderFiltersOf('! Prototypes/Frogger (USA) (Proto).zip', defaults)).toEqual([
      'prototype',
    ]);
  });

  it('US-C12: a game in no prefixed folder gets the outside filter', () => {
    expect(folderFiltersOf('Columns (USA).zip', defaults)).toEqual(['official']);
    expect(folderFiltersOf('Disc games/Example.zip', defaults)).toEqual(['official']);
  });

  it('US-C12: nested prefixed folders each add a filter', () => {
    expect(folderFiltersOf('! Hacks/! Hacks-SMW/Example Hack.zip', defaults)).toEqual([
      'hack',
      'hacks-smw',
    ]);
    expect(folderFiltersOf('+RPG/Plain/Example.zip', defaults)).toEqual(['rpg']);
  });

  it('FR-LIB-18: the file name itself never adds a filter', () => {
    expect(folderFiltersOf('! Odd name.zip', defaults)).toEqual(['official']);
  });

  it('US-C12: a folder named like a known filter, singular or plural, gives that filter', () => {
    expect(folderFiltersOf('! Hacks/a.zip', defaults)).toEqual(['hack']);
    expect(folderFiltersOf('! Homebrews/a.zip', defaults)).toEqual(['homebrew']);
    expect(folderFiltersOf('! Translations/a.zip', defaults)).toEqual(['translation']);
    expect(folderFiltersOf('! Unlicensed/a.zip', defaults)).toEqual(['unlicensed']);
    expect(folderFiltersOf('! Translated/a.zip', defaults)).toEqual(['translated']);
    const rules = folderFilterRules(
      FolderFiltersSchema.parse({ renames: [{ folder: 'Hacks', filter: 'Mods' }] }),
    );
    expect(folderFiltersOf('! Hacks/a.zip', rules)).toEqual(['mods']);
  });

  it('FR-LIB-18: every known filter has a label in each language', () => {
    for (const slug of KNOWN_FILTERS) {
      expect(en.frontend.filters).toHaveProperty(slug);
      expect(ptBR.frontend.filters).toHaveProperty(slug);
    }
  });

  it('US-C12: a rename maps a folder to another filter, ignoring case', () => {
    const rules = folderFilterRules(
      FolderFiltersSchema.parse({ renames: [{ folder: 'homebrews', filter: 'Homebrew' }] }),
    );
    expect(folderFiltersOf('! Homebrews/Example.zip', rules)).toEqual(['homebrew']);
  });

  it('US-C12: an empty outside filter or no prefixes give no folder filters', () => {
    const noOutside = folderFilterRules(FolderFiltersSchema.parse({ outside: '' }));
    expect(folderFiltersOf('Columns (USA).zip', noOutside)).toEqual([]);
    const off = folderFilterRules(FolderFiltersSchema.parse({ prefixes: [], outside: '' }));
    expect(folderFiltersOf('! Prototypes/Frogger.zip', off)).toEqual([]);
  });

  it('FR-LIB-18: with no prefixes, every game gets the outside filter', () => {
    const rules = folderFilterRules(FolderFiltersSchema.parse({ prefixes: [] }));
    expect(folderFiltersOf('! Prototypes/Frogger.zip', rules)).toEqual(['official']);
  });

  it('FR-LIB-18: # counts only when chosen', () => {
    expect(folderFiltersOf('#2003/Example.zip', defaults)).toEqual(['official']);
    const rules = folderFilterRules(FolderFiltersSchema.parse({ prefixes: ['#'] }));
    expect(folderFiltersOf('#2003/Example.zip', rules)).toEqual(['2003']);
  });

  it('FR-LIB-18: a folder with nothing slug-like adds nothing; repeats count once', () => {
    expect(folderFiltersOf('! ***/Example.zip', defaults)).toEqual(['official']);
    expect(folderFiltersOf('! Hacks/+Hack/Example.zip', defaults)).toEqual(['hack']);
  });

  it('FR-LIB-18: empty or repeated rename folders and names with no filter are refused', () => {
    expect(issues({ renames: [{ folder: ' ', filter: 'x' }] })).not.toEqual([]);
    expect(
      issues({
        renames: [
          { folder: 'Homebrews', filter: 'Homebrew' },
          { folder: 'homebrews ', filter: 'Other' },
        ],
      }),
    ).toEqual([['renames.1.folder', 'duplicateRename']]);
    expect(issues({ renames: [{ folder: 'A', filter: '***' }] })).toEqual([
      ['renames.0.filter', 'notAFilterName'],
    ]);
    expect(issues({ outside: '***' })).toEqual([['outside', 'notAFilterName']]);
    expect(issues({ prefixes: ['!', '!'] })).not.toEqual([]);
  });

  it('FR-LIB-18: the fingerprint changes only when the rules do', () => {
    const a = folderFiltersFingerprint(FolderFiltersSchema.parse({}));
    expect(folderFiltersFingerprint(FolderFiltersSchema.parse({ prefixes: ['+', '!'] }))).toBe(a);
    expect(folderFiltersFingerprint(FolderFiltersSchema.parse({ outside: '' }))).not.toBe(a);
  });
});
