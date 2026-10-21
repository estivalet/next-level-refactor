import { describe, expect, it } from 'vitest';
import { GeneralSchema, SettingsSchema, defaultSettings, fieldMeta } from './schema.ts';

describe('SettingsSchema', () => {
  it('FR-SET-2: an empty file with schemaVersion 1 is valid and gets defaults', () => {
    expect(SettingsSchema.parse({ schemaVersion: 1 })).toEqual(defaultSettings());
    expect(defaultSettings().general).toEqual({
      language: 'en',
      startWithWindows: false,
      setupCompletedAt: null,
    });
  });

  it('FR-SET-2: wrong types fail with the field path', () => {
    const result = SettingsSchema.safeParse({ schemaVersion: 1, general: { language: 'xx' } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['general', 'language']);
  });

  it('unknown keys are stripped', () => {
    const parsed = SettingsSchema.parse({ schemaVersion: 1, general: { langauge: 'pt-BR' }, x: 1 });
    expect(parsed).toEqual(defaultSettings());
  });

  it('schemaVersion other than 1 fails', () => {
    expect(SettingsSchema.safeParse({ schemaVersion: 2 }).success).toBe(false);
  });

  it('fieldMeta returns label keys for form fields only', () => {
    expect(fieldMeta(GeneralSchema.shape.language)).toEqual({
      labelKey: 'settings.fields.general.language.label',
      helpKey: 'settings.fields.general.language.help',
    });
    expect(fieldMeta(GeneralSchema.shape.setupCompletedAt)).toBeUndefined();
  });
});
